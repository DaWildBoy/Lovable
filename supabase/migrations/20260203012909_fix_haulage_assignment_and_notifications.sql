/*
  # Fix Haulage Company Job Assignment and Notifications

  ## Overview
  Fixes critical issues for haulage company accounts:
  1. RLS infinite recursion when assigning driver/vehicle to jobs
  2. Notifications not working for haulage companies
  3. Performance indexes for faster queries

  ## Changes
  
  ### 1. RPC Function for Job Assignment (Fixes Infinite Recursion)
  - Creates assign_driver_vehicle_to_job() function with SECURITY DEFINER
  - Validates caller permissions without triggering RLS recursion
  - Updates job with driver and vehicle assignment

  ### 2. Notifications RLS for Haulage Companies
  - Allows haulage companies to view notifications for their company
  - Supports both company-level and user-level notifications

  ### 3. Performance Indexes
  - Adds indexes on frequently queried columns for jobs and notifications

  ## Security
  - RPC function validates:
    - User is authenticated
    - User belongs to haulage company
    - Job is unassigned
    - Driver and vehicle belong to user's company
  - Notifications RLS ensures proper access control
*/

-- =====================================================
-- 1. RPC FUNCTION FOR JOB ASSIGNMENT (NO RLS RECURSION)
-- =====================================================

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

  -- Update job assignment record
  INSERT INTO job_assignments (
    job_id,
    driver_id,
    vehicle_id,
    assigned_by_user_id,
    reassigned_at
  )
  VALUES (
    p_job_id,
    p_driver_id,
    p_vehicle_id,
    v_user_id,
    NOW()
  )
  ON CONFLICT (job_id) DO UPDATE SET
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
    'vehicle_id', v_vehicle_id,
    'driver_name', v_driver_name,
    'vehicle_label', v_vehicle_label,
    'company_name', v_company_name
  );

  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION assign_driver_vehicle_to_job TO authenticated;

-- =====================================================
-- 2. FIX NOTIFICATIONS RLS FOR HAULAGE COMPANIES
-- =====================================================

-- Drop existing notification select policy if exists
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;

-- Create new policy that supports both individual users and haulage companies
CREATE POLICY "Users can view their notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    -- Haulage company users can see company notifications
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'business'
        AND profiles.business_type = 'haulage'
        AND (
          -- Direct company notification
          notifications.user_id = profiles.id
          -- Or if we add company_id field later
          OR (notifications.data->>'company_id')::uuid = profiles.id
        )
    )
  );

-- =====================================================
-- 3. PERFORMANCE INDEXES
-- =====================================================

-- Jobs table indexes for haulage queries
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_company_id 
  ON jobs(assigned_company_id) 
  WHERE assigned_company_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_driver_id 
  ON jobs(assigned_driver_id) 
  WHERE assigned_driver_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_status_created 
  ON jobs(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_status_assigned_company 
  ON jobs(status, assigned_company_id) 
  WHERE assigned_company_id IS NOT NULL;

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_created 
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, read, created_at DESC);

-- Haulage drivers/vehicles indexes
CREATE INDEX IF NOT EXISTS idx_haulage_drivers_company_active 
  ON haulage_drivers(company_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_haulage_vehicles_company_active 
  ON haulage_vehicles(company_id, is_active) 
  WHERE is_active = true;

-- =====================================================
-- 4. NOTIFICATION TRIGGERS FOR HAULAGE EVENTS
-- =====================================================

-- Function to notify haulage company when job is assigned
CREATE OR REPLACE FUNCTION notify_haulage_job_assigned()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger when job moves to 'assigned' status with haulage assignment
  IF NEW.status = 'assigned' 
     AND NEW.assignment_type = 'haulage_dispatch'
     AND NEW.assigned_company_id IS NOT NULL
     AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN
    
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      NEW.assigned_company_id,
      'job_assigned',
      'Job Assigned Successfully',
      format('Job #%s assigned to driver %s with vehicle %s',
        substring(NEW.id::text, 1, 8),
        COALESCE(NEW.assigned_driver_name, 'Unknown'),
        COALESCE(NEW.assigned_vehicle_label, 'Unknown')
      ),
      jsonb_build_object(
        'job_id', NEW.id,
        'driver_id', NEW.assigned_driver_id,
        'vehicle_id', NEW.assigned_vehicle_id,
        'driver_name', NEW.assigned_driver_name,
        'vehicle_label', NEW.assigned_vehicle_label
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_notify_haulage_job_assigned ON jobs;
CREATE TRIGGER trigger_notify_haulage_job_assigned
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_haulage_job_assigned();
