/*
  # Fix RPC Function - Add company_id to job_assignments

  ## Problem
  The assign_driver_vehicle_to_job RPC function was missing the company_id field
  when inserting into job_assignments table, causing a NOT NULL constraint violation.

  ## Solution
  Update the RPC function to include company_id in the insert statement.

  ## Changes
  - Add company_id to the INSERT INTO job_assignments statement
*/

CREATE OR REPLACE FUNCTION assign_driver_vehicle_to_job(
  p_job_id uuid,
  p_driver_id uuid,
  p_vehicle_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_company_id uuid;
  v_driver_company_id uuid;
  v_vehicle_company_id uuid;
  v_job_status text;
  v_job_assigned_company_id uuid;
  v_driver_name text;
  v_vehicle_label text;
  v_company_name text;
  v_company_logo_url text;
  v_result jsonb;
BEGIN
  -- Get authenticated user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user's company info
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

  -- Validate job is unassigned (without RLS recursion)
  SELECT status, assigned_company_id
  INTO v_job_status, v_job_assigned_company_id
  FROM jobs
  WHERE id = p_job_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_job_status NOT IN ('open', 'bidding') THEN
    RAISE EXCEPTION 'Job is not available for assignment (status: %)', v_job_status;
  END IF;

  IF v_job_assigned_company_id IS NOT NULL THEN
    RAISE EXCEPTION 'Job is already assigned to another company';
  END IF;

  -- Validate driver belongs to company
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

  -- Validate vehicle belongs to company
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

  -- Update job assignment record (FIXED: Added company_id)
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

  -- Update job with assignment details (no RLS check here)
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

  -- Return success with details
  v_result := jsonb_build_object(
    'success', true,
    'job_id', p_job_id,
    'driver_id', p_driver_id,
    'vehicle_id', p_vehicle_id,
    'driver_name', v_driver_name,
    'vehicle_label', v_vehicle_label,
    'company_name', v_company_name
  );

  RETURN v_result;
END;
$$;
