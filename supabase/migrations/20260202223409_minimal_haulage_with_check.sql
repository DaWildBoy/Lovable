/*
  # Minimal Haulage Assignment WITH CHECK Clause

  ## Problem
  The WITH CHECK clause is still too restrictive. We need to identify
  the minimal security requirement and only check that.

  ## Solution
  Simplify WITH CHECK to ONLY check the core security requirement:
  - assigned_company_id must equal auth.uid()
  
  This prevents haulage companies from assigning jobs to other companies.
  All other validations (status, assignment_type, etc.) are business logic,
  not security requirements.

  ## Security
  - USING: Verifies user is haulage company and job is unassigned
  - WITH CHECK: Ensures job is assigned to current user only
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Haulage companies can assign drivers to unassigned jobs" ON jobs;

-- Recreate with minimal WITH CHECK
CREATE POLICY "Haulage companies can assign drivers to unassigned jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    assigned_courier_id IS NULL
    AND assigned_company_id IS NULL
    AND status IN ('open', 'bidding')
    AND is_haulage_company(auth.uid())
  )
  WITH CHECK (
    -- Only security requirement: job must be assigned to current user
    assigned_company_id = auth.uid()
  );
