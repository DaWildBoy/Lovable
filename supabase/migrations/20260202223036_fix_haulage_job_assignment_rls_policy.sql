/*
  # Fix Haulage Job Assignment RLS Policy

  ## Problem
  The current RLS policy blocks haulage companies from assigning drivers and vehicles
  to jobs because the WITH CHECK clause is too restrictive. It doesn't properly validate
  all the fields being updated during assignment (assigned_driver_id, assigned_vehicle_id, 
  assignment_type, assigned_driver_name, assigned_vehicle_label, assigned_company_name, 
  assigned_company_logo_url).

  ## Solution
  Create a comprehensive UPDATE policy that:
  1. Allows haulage companies to assign jobs that are currently unassigned
  2. Validates that the company is assigning the job to themselves
  3. Permits all assignment-related fields to be set
  4. Maintains security by ensuring assigned_company_id = auth.uid()

  ## Security
  - USING clause: Only allows updating jobs that are unassigned (no assigned_courier_id or assigned_company_id)
  - WITH CHECK clause: Ensures assigned_company_id is set to the current user's ID
  - Both clauses verify the user is a haulage company via SECURITY DEFINER function
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Haulage companies can accept unassigned jobs" ON jobs;

-- Create a comprehensive policy for haulage job assignment
CREATE POLICY "Haulage companies can assign drivers to unassigned jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    -- Can only update jobs that are currently unassigned
    assigned_courier_id IS NULL
    AND assigned_company_id IS NULL
    AND status IN ('open', 'bidding')
    -- Must be a haulage company
    AND is_haulage_company(auth.uid())
  )
  WITH CHECK (
    -- After update, the job must be assigned to the current user's company
    assigned_company_id = auth.uid()
    -- Verify user is still a haulage company
    AND is_haulage_company(auth.uid())
    -- Allow status to transition to 'assigned'
    AND status = 'assigned'
    -- Optional: Ensure assignment type is valid if set
    AND (assignment_type IS NULL OR assignment_type IN ('haulage_dispatch', 'direct'))
  );
