/*
  # Add Haulage Company Job Acceptance Policy

  ## Problem
  Haulage companies (business accounts) cannot accept jobs because:
  1. Existing courier policies require assigned_courier_id to be set
  2. Haulage companies use assigned_company_id instead of assigned_courier_id
  3. No policy exists for business accounts to accept jobs

  ## Solution
  Add RLS policy that allows haulage companies to:
  1. Accept jobs in 'open' or 'bidding' status
  2. Update jobs with their company assignment details
  3. Set assignment_type = 'haulage_dispatch'

  ## Changes
  - Add new UPDATE policy for haulage companies
  - Policy validates user is a business account with business_type = 'haulage'
  - Allows updating unassigned jobs with haulage company assignment details
*/

-- Create policy for haulage companies to accept and update jobs
CREATE POLICY "Haulage companies can accept unassigned jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    -- Can only update jobs that are available for assignment
    assigned_courier_id IS NULL 
    AND assigned_company_id IS NULL
    AND status IN ('open', 'bidding')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'business'
      AND profiles.business_type = 'haulage'
    )
  )
  WITH CHECK (
    -- After update, job must be assigned to the haulage company
    assigned_company_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'business'
      AND profiles.business_type = 'haulage'
    )
  );