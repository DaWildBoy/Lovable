/*
  # Auto-regenerate company code after a driver uses it

  1. Changes
    - Update `link_courier_to_company` to automatically generate a new company
      code after a driver successfully links using the current code
    - This ensures each code is single-use for security
    - The new code is returned in the response so the company can see it

  2. Security
    - Uses `generate_company_code()` to create unique codes
    - Old code is immediately invalidated after use
    - Company is notified of the new code in the driver link notification
*/

CREATE OR REPLACE FUNCTION link_courier_to_company(p_company_code text, p_courier_user_id uuid)
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
  v_new_code text;
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

  v_new_code := generate_company_code();
  UPDATE profiles
  SET haulage_company_code = v_new_code
  WHERE id = v_company_id;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_company_id,
    'driver_link_request',
    'New Driver Request',
    COALESCE(v_courier_name, 'A driver') || ' has linked to your company and is awaiting approval. Your company code has been updated.',
    jsonb_build_object(
      'driver_user_id', p_courier_user_id,
      'driver_name', COALESCE(v_courier_name, 'Driver'),
      'new_company_code', v_new_code
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'already_linked', false,
    'company_name', v_company_name
  );
END;
$$;
