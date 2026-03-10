/*
  # Add Company Driver Flag and Fix Company Code Trigger

  1. Changes to `profiles` table
    - `is_company_driver` (boolean, default false) - Indicates if a courier is a company driver
    - `linked_company_id` (uuid, nullable) - References the haulage company profile the driver is linked to

  2. Fix auto-generate company code trigger
    - The trigger previously checked for `role = 'haulage'` but haulage companies use
      `role = 'business'` with `business_type = 'haulage'`
    - Updated trigger to check the correct condition

  3. Fix link_courier_to_company RPC
    - Updated to check `role = 'business' AND business_type = 'haulage'` instead of `role = 'haulage'`
    - Now also sets `is_company_driver = true` and `linked_company_id` on the courier's profile

  4. Backfill company codes for existing haulage companies
    - Generates codes for any haulage companies that completed onboarding but don't have codes yet
*/

-- Add is_company_driver flag to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_company_driver'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_company_driver boolean DEFAULT false;
  END IF;
END $$;

-- Add linked_company_id to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'linked_company_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN linked_company_id uuid REFERENCES profiles(id);
  END IF;
END $$;

-- Fix the auto-generate company code trigger to use correct role check
CREATE OR REPLACE FUNCTION auto_generate_company_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (NEW.role = 'haulage' OR (NEW.role = 'business' AND NEW.business_type = 'haulage'))
    AND NEW.haulage_onboarding_completed = true
    AND (OLD.haulage_onboarding_completed IS NULL OR OLD.haulage_onboarding_completed = false)
    AND NEW.haulage_company_code IS NULL
  THEN
    NEW.haulage_company_code := generate_company_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill company codes for haulage companies that completed onboarding but have no code
UPDATE profiles
SET haulage_company_code = generate_company_code()
WHERE role = 'business'
  AND business_type = 'haulage'
  AND haulage_onboarding_completed = true
  AND haulage_company_code IS NULL;

-- Fix the link_courier_to_company RPC to check correct role and set driver flag
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
BEGIN
  SELECT id, company_name INTO v_company_id, v_company_name
  FROM profiles
  WHERE haulage_company_code = upper(p_company_code)
    AND (role = 'haulage' OR (role = 'business' AND business_type = 'haulage'));

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid company code');
  END IF;

  SELECT id INTO v_existing_link
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

  SELECT full_name INTO v_courier_name
  FROM profiles
  WHERE id = p_courier_user_id;

  INSERT INTO haulage_drivers (company_id, user_id, full_name, is_active)
  VALUES (v_company_id, p_courier_user_id, COALESCE(v_courier_name, 'Driver'), true);

  UPDATE profiles
  SET is_company_driver = true,
      linked_company_id = v_company_id
  WHERE id = p_courier_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'already_linked', false,
    'company_name', v_company_name
  );
END;
$$;

-- Backfill is_company_driver for existing linked drivers
UPDATE profiles p
SET is_company_driver = true,
    linked_company_id = hd.company_id
FROM haulage_drivers hd
WHERE hd.user_id = p.id
  AND hd.user_id IS NOT NULL
  AND p.is_company_driver = false;
