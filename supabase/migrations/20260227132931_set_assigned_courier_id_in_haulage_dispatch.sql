/*
  # Set assigned_courier_id for haulage dispatch assignments

  ## Overview
  When a haulage company assigns a driver to a job via the RPC function,
  this migration updates the function to also set `assigned_courier_id`
  to the driver's `user_id`. This ensures:
  
  1. The driver receives assignment notifications (the notification trigger
     checks `assigned_courier_id` to find the courier user)
  2. The driver can query their assigned jobs using `assigned_courier_id = auth.uid()`
  3. The existing delivery flow (status updates, POD, etc.) works correctly
     since it relies on `assigned_courier_id`

  ## Changes
  1. Modified `assign_driver_vehicle_to_job` RPC to look up `haulage_drivers.user_id`
     and set `jobs.assigned_courier_id` alongside the other assignment fields
  
  ## Security
  - Function remains SECURITY DEFINER
  - Only approved haulage companies can call this function
  - Driver must belong to the calling company
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
  v_driver_user_id uuid;
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

  SELECT company_id, full_name, user_id
  INTO v_driver_company_id, v_driver_name, v_driver_user_id
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

  IF v_job_status = 'assigned' AND v_job_assigned_company_id != v_company_id THEN
    RAISE EXCEPTION 'Job is already assigned to another company';
  END IF;

  IF v_job_status NOT IN ('open', 'bidding') THEN
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
    assigned_courier_id = v_driver_user_id,
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
