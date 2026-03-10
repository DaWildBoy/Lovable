/*
  # Fix Company Driver Approval RPC

  1. Changes
    - Updated `approve_company_driver` to handle case where courier record may not exist
    - Updated `approve_company_driver` to use profile ID check properly
    - Added upsert logic for couriers table so company drivers always get a courier record on approval
  
  2. Important Notes
    - The function creates a courier record if one doesn't exist during approval
    - This ensures company drivers can always be properly verified
*/

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
  v_caller_id uuid;
  v_courier_exists boolean;
BEGIN
  v_caller_id := auth.uid();

  SELECT hd.company_id, hd.user_id, hd.full_name
  INTO v_company_id, v_driver_user_id, v_driver_name
  FROM haulage_drivers hd
  WHERE hd.id = p_driver_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver not found');
  END IF;

  IF v_company_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized to approve drivers for this company');
  END IF;

  SELECT company_name INTO v_company_name
  FROM profiles WHERE id = v_company_id;

  UPDATE haulage_drivers
  SET company_approved = true,
      approved_at = now(),
      approved_by = v_caller_id,
      updated_at = now()
  WHERE id = p_driver_id;

  IF v_driver_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM couriers WHERE user_id = v_driver_user_id
    ) INTO v_courier_exists;

    IF v_courier_exists THEN
      UPDATE couriers
      SET verified = true,
          verification_status = 'approved',
          updated_at = now()
      WHERE user_id = v_driver_user_id;
    ELSE
      INSERT INTO couriers (user_id, vehicle_type, vehicle_make, vehicle_model, vehicle_year, vehicle_plate, verified, verification_status)
      VALUES (v_driver_user_id, 'truck', 'Assigned by company', 'Assigned by company', extract(year from now())::int, 'Assigned by company', true, 'approved');
    END IF;

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
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();

  SELECT hd.company_id, hd.user_id, hd.full_name
  INTO v_company_id, v_driver_user_id, v_driver_name
  FROM haulage_drivers hd
  WHERE hd.id = p_driver_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver not found');
  END IF;

  IF v_company_id != v_caller_id THEN
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

GRANT EXECUTE ON FUNCTION approve_company_driver(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_company_driver(uuid) TO authenticated;
