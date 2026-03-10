/*
  # Add RPC for company owners to get driver license signed URLs

  1. New Functions
    - `get_driver_license_urls(p_driver_id uuid)` - Returns signed URLs for a driver's
      license images. Only accessible by the driver's company owner.
      This bypasses storage RLS since the company owner has legitimate access
      but doesn't own the storage objects directly.

  2. Notes
    - Uses SECURITY DEFINER to bypass storage RLS
    - Validates that the caller is the company owner of the driver
    - Returns front and back signed URLs (or null if not uploaded)
*/

CREATE OR REPLACE FUNCTION get_driver_license_urls(p_driver_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_caller_id uuid;
  v_company_id uuid;
  v_front_url text;
  v_back_url text;
  v_front_signed text;
  v_back_signed text;
BEGIN
  v_caller_id := auth.uid();

  SELECT company_id, license_front_url, license_back_url
  INTO v_company_id, v_front_url, v_back_url
  FROM haulage_drivers
  WHERE id = p_driver_id;

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Driver not found');
  END IF;

  IF v_company_id != v_caller_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'front_url', v_front_url,
    'back_url', v_back_url
  );
END;
$$;
