/*
  # Fix Job Assignments Insert Policy

  ## Problem
  The current RLS policy for inserting job_assignments requires the job to already have
  assigned_courier_id = auth.uid(), but this creates a chicken-and-egg problem:
  - Can't insert assignment until job is assigned
  - But job assignment happens AFTER inserting the assignment record

  ## Solution
  Update the INSERT policy to allow companies to create assignments for:
  1. Jobs in 'open' or 'bidding' status (accepting new jobs)
  2. Jobs already assigned to them (for reassignments)

  ## Changes
  - Drop old "Company can insert assignments for their accepted jobs" policy
  - Create new policy that allows inserting for available OR assigned jobs
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Company can insert assignments for their accepted jobs" 
  ON job_assignments;

-- Create new policy that allows inserting for available jobs
CREATE POLICY "Company can insert assignments for available or assigned jobs"
  ON job_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = company_id AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'business'
      AND profiles.business_type = 'haulage'
    ) AND
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_assignments.job_id
      AND (
        jobs.status IN ('open', 'bidding')
        OR jobs.assigned_courier_id = auth.uid()
      )
    )
  );