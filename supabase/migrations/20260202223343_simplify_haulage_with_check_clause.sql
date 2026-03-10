/*
  # Simplify Haulage Assignment WITH CHECK Clause

  ## Problem
  The WITH CHECK clause in the haulage assignment policy is too restrictive
  and may be causing RLS failures. Calling is_haulage_company() in WITH CHECK
  can cause recursion or performance issues.

  ## Solution
  Simplify the WITH CHECK clause to focus solely on data validation:
  - Ensure assigned_company_id equals the current user
  - Allow reasonable status values
  - Remove the redundant is_haulage_company check (already in USING)

  ## Security
  Security is maintained because:
  - USING clause already verified user is a haulage company
  - WITH CHECK ensures assigned_company_id = auth.uid() (prevents assigning to other companies)
  - Status transitions are validated
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Haulage companies can assign drivers to unassigned jobs" ON jobs;

-- Recreate with simplified WITH CHECK
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
    -- Core security: job must be assigned to the current user's company
    assigned_company_id = auth.uid()
    -- Allow status to be assigned or remain in open/bidding states
    AND status IN ('assigned', 'open', 'bidding')
  );
