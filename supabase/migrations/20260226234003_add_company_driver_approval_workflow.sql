/*
  # Add Company Driver Approval Workflow

  1. Modified Tables
    - `haulage_drivers`
      - Add `company_approved` (boolean, default false) - Tracks whether the haulage company has approved a linked driver
      - Add `approved_at` (timestamptz, nullable) - When the company approved the driver
      - Add `approved_by` (uuid, nullable) - Who approved the driver (company user)

  2. Modified Functions
    - `link_courier_to_company` - Updated to set company_approved = false for new links, and create a notification for the haulage company

  3. New Functions
    - `approve_company_driver` - RPC for haulage companies to approve pending drivers
    - `reject_company_driver` - RPC for haulage companies to reject pending drivers

  4. Security
    - Haulage companies can only approve/reject their own drivers
    - Notifications are created securely via SECURITY DEFINER functions

  5. Important Notes
    - New drivers linking via company code will default to NOT approved
    - The haulage company must approve them before they can access jobs
    - A notification is sent to the haulage company when a driver links
*/

-- 1. Add approval columns to haulage_drivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'haulage_drivers' AND column_name = 'company_approved'
  ) THEN
    ALTER TABLE haulage_drivers ADD COLUMN company_approved boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'haulage_drivers' AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE haulage_drivers ADD COLUMN approved_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'haulage_drivers' AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE haulage_drivers ADD COLUMN approved_by uuid REFERENCES profiles(id);
  END IF;
END $$;

-- 2. Update link_courier_to_company to set company_approved = false and notify company
CREATE OR REPLACE FUNCTION link_courier_to_company(
  p_company_code text,
  p_courier_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_courier_name text;
  v_existing_link uuid;
  v_already_approved boolean;
BEGIN
  SELECT id, company_name INTO v_company_id, v_company_name
  FROM profiles
  WHERE haulage_company_code = upper(p_company_code)
    AND (role = 'haulage' OR (role = 'business' AND business_type = 'haulage'));

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid company code');
  END IF;

  SELECT full_name INTO v_courier_name
  FROM profiles
  WHERE id = p_courier_user_id;

  SELECT id, company_approved INTO v_existing_link, v_already_approved
  FROM haulage_drivers
  WHERE company_id = v_company_id AND user_id = p_courier_user_id;

  IF v_existing_link IS NOT NULL THEN
    UPDATE profiles
    SET is_company_driver = true,
        linked_company_id = v_company_id
    WHERE id = p_courier_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'already_linked', true,
      'company_name', v_company_name
    );
  END IF;

  INSERT INTO haulage_drivers (company_id, user_id, full_name, is_active, company_approved)
  VALUES (v_company_id, p_courier_user_id, COALESCE(v_courier_name, 'Driver'), true, false);

  UPDATE profiles
  SET is_company_driver = true,
      linked_company_id = v_company_id
  WHERE id = p_courier_user_id;

  INSERT INTO notifications (user_id, type, title, message, metadata)
  VALUES (
    v_company_id,
    'driver_link_request',
    'New Driver Request',
    COALESCE(v_courier_name, 'A driver') || ' has linked to your company and is awaiting approval.',
    jsonb_build_object(
      'driver_user_id', p_courier_user_id,
      'driver_name', COALESCE(v_courier_name, 'Driver')
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_linked', false,
    'company_name', v_company_name
  );
END;
$$;

-- 3. Create approve_company_driver RPC
CREATE OR REPLACE FUNCTION approve_company_driver(
  p_driver_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_driver_user_id uuid;
  v_driver_name text;
  v_company_name text;
BEGIN
  SELECT hd.company_id, hd.user_id, hd.full_name
  INTO v_company_id, v_driver_user_id, v_driver_name
  FROM haulage_drivers hd
  WHERE hd.id = p_driver_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver not found');
  END IF;

  IF v_company_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT company_name INTO v_company_name
  FROM profiles WHERE id = v_company_id;

  UPDATE haulage_drivers
  SET company_approved = true,
      approved_at = now(),
      approved_by = auth.uid(),
      updated_at = now()
  WHERE id = p_driver_id;

  IF v_driver_user_id IS NOT NULL THEN
    UPDATE couriers
    SET verified = true,
        verification_status = 'approved',
        updated_at = now()
    WHERE user_id = v_driver_user_id;

    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      v_driver_user_id,
      'driver_approved',
      'Account Approved',
      'Your account has been approved by ' || COALESCE(v_company_name, 'your company') || '. You can now access jobs.',
      jsonb_build_object(
        'company_id', v_company_id,
        'company_name', COALESCE(v_company_name, '')
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 4. Create reject_company_driver RPC
CREATE OR REPLACE FUNCTION reject_company_driver(
  p_driver_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_driver_user_id uuid;
  v_driver_name text;
  v_company_name text;
BEGIN
  SELECT hd.company_id, hd.user_id, hd.full_name
  INTO v_company_id, v_driver_user_id, v_driver_name
  FROM haulage_drivers hd
  WHERE hd.id = p_driver_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver not found');
  END IF;

  IF v_company_id != auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  SELECT company_name INTO v_company_name
  FROM profiles WHERE id = v_company_id;

  UPDATE haulage_drivers
  SET is_active = false,
      company_approved = false,
      updated_at = now()
  WHERE id = p_driver_id;

  IF v_driver_user_id IS NOT NULL THEN
    UPDATE profiles
    SET is_company_driver = false,
        linked_company_id = NULL
    WHERE id = v_driver_user_id;

    INSERT INTO notifications (user_id, type, title, message, metadata)
    VALUES (
      v_driver_user_id,
      'driver_rejected',
      'Link Request Declined',
      'Your request to join ' || COALESCE(v_company_name, 'the company') || ' was not approved. Please contact the company for more information.',
      jsonb_build_object(
        'company_id', v_company_id,
        'company_name', COALESCE(v_company_name, '')
      )
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;
