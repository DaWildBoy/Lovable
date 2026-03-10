/*
  # Create assign_driver_vehicle_to_job RPC function

  1. New Function
    - `assign_driver_vehicle_to_job(p_job_id, p_driver_id, p_vehicle_id)` - SECURITY DEFINER RPC
    - Validates the calling user is an approved haulage company
    - Validates driver and vehicle belong to the company and are active
    - Uses row-level locking (FOR UPDATE) to prevent race conditions
    - Idempotent: returns success if already assigned with same driver/vehicle
    - Updates both job_assignments and jobs tables atomically
    - Returns JSON with assignment details

  2. Security
    - SECURITY DEFINER bypasses RLS for internal operations
    - Auth check ensures only authenticated haulage companies can call
    - Ownership validation ensures drivers/vehicles belong to caller's company

  3. Important Notes
    - This function is the sole entry point for haulage job acceptance
    - Prevents double-assignment via FOR UPDATE row locking
*/

CREATE OR REPLACE FUNCTION public.assign_driver_vehicle_to_job(
  p_job_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_driver_company_id uuid;
  v_vehicle_company_id uuid;
  v_job_status text;
  v_job_assigned_company_id uuid;
  v_job_assigned_driver_id uuid;
  v_job_assigned_vehicle_id uuid;
  v_driver_name text;
  v_vehicle_label text;
  v_company_name text;
  v_company_logo_url text;
  v_result jsonb;
  v_rows_updated integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT id, company_name, haulage_company_logo_url
  INTO v_company_id, v_company_name, v_company_logo_url
  FROM profiles
  WHERE id = v_user_id
    AND role = 'business'
    AND business_type = 'haulage'
    AND business_verification_status = 'approved';

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'User is not an approved haulage company';
  END IF;

  SELECT company_id, full_name
  INTO v_driver_company_id, v_driver_name
  FROM haulage_drivers
  WHERE id = p_driver_id
    AND is_active = true;

  IF v_driver_company_id IS NULL THEN
    RAISE EXCEPTION 'Driver not found or inactive';
  END IF;

  IF v_driver_company_id != v_company_id THEN
    RAISE EXCEPTION 'Driver does not belong to your company';
  END IF;

  SELECT company_id,
    COALESCE(vehicle_name || ' (' || plate_number || ')', vehicle_name) as label
  INTO v_vehicle_company_id, v_vehicle_label
  FROM haulage_vehicles
  WHERE id = p_vehicle_id
    AND is_active = true;

  IF v_vehicle_company_id IS NULL THEN
    RAISE EXCEPTION 'Vehicle not found or inactive';
  END IF;

  IF v_vehicle_company_id != v_company_id THEN
    RAISE EXCEPTION 'Vehicle does not belong to your company';
  END IF;

  SELECT status, assigned_company_id, assigned_driver_id, assigned_vehicle_id
  INTO v_job_status, v_job_assigned_company_id, v_job_assigned_driver_id, v_job_assigned_vehicle_id
  FROM jobs
  WHERE id = p_job_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_job_status = 'assigned'
     AND v_job_assigned_company_id = v_company_id
     AND v_job_assigned_driver_id = p_driver_id
     AND v_job_assigned_vehicle_id = p_vehicle_id THEN
    v_result := jsonb_build_object(
      'success', true,
      'job_id', p_job_id,
      'driver_id', p_driver_id,
      'vehicle_id', p_vehicle_id,
      'driver_name', v_driver_name,
      'vehicle_label', v_vehicle_label,
      'company_name', v_company_name,
      'already_assigned', true
    );
    RETURN v_result;
  END IF;

  IF v_job_status = 'assigned' AND v_job_assigned_company_id IS NOT NULL AND v_job_assigned_company_id != v_company_id THEN
    RAISE EXCEPTION 'Job is already assigned to another company';
  END IF;

  IF v_job_status NOT IN ('open', 'bidding', 'assigned') THEN
    RAISE EXCEPTION 'Job is not available for assignment (status: %)', v_job_status;
  END IF;

  INSERT INTO job_assignments (
    job_id,
    company_id,
    driver_id,
    vehicle_id,
    assigned_by_user_id,
    reassigned_at
  )
  VALUES (
    p_job_id,
    v_company_id,
    p_driver_id,
    p_vehicle_id,
    v_user_id,
    NOW()
  )
  ON CONFLICT (job_id) DO UPDATE SET
    company_id = EXCLUDED.company_id,
    driver_id = EXCLUDED.driver_id,
    vehicle_id = EXCLUDED.vehicle_id,
    assigned_by_user_id = EXCLUDED.assigned_by_user_id,
    reassigned_at = EXCLUDED.reassigned_at;

  UPDATE jobs SET
    status = 'assigned',
    assigned_company_id = v_company_id,
    assigned_driver_id = p_driver_id,
    assigned_vehicle_id = p_vehicle_id,
    assignment_type = 'haulage_dispatch',
    assigned_driver_name = v_driver_name,
    assigned_vehicle_label = v_vehicle_label,
    assigned_company_name = v_company_name,
    assigned_company_logo_url = v_company_logo_url,
    updated_at = NOW()
  WHERE id = p_job_id;

  GET DIAGNOSTICS v_rows_updated = ROW_COUNT;

  IF v_rows_updated = 0 THEN
    RAISE EXCEPTION 'Failed to update job - no rows affected';
  END IF;

  v_result := jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'driver_id', p_driver_id,
    'vehicle_id', p_vehicle_id,
    'driver_name', v_driver_name,
    'vehicle_label', v_vehicle_label,
    'company_name', v_company_name,
    'already_assigned', false
  );

  RETURN v_result;
END;
$function$;
