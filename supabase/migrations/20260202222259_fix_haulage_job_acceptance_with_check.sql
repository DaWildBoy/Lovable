/*
  # Fix Haulage Job Acceptance WITH CHECK Clause

  ## Problem
  The WITH CHECK clause for "Haulage companies can accept unassigned jobs" policy
  is too restrictive. It only checks assigned_company_id = auth.uid(), but the
  update also changes status to 'assigned' and sets multiple assignment fields.

  ## Solution
  Update the WITH CHECK clause to permit:
  - Status being changed to 'assigned'
  - assigned_company_id being set to the current user
  - Assignment-related fields being populated

  ## Changes
  Drop and recreate the policy with a more permissive WITH CHECK clause
*/

-- Drop existing policy
DROP POLICY IF EXISTS "Haulage companies can accept unassigned jobs" ON jobs;

-- Recreate policy with corrected WITH CHECK clause
CREATE POLICY "Haulage companies can accept unassigned jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    assigned_courier_id IS NULL
    AND assigned_company_id IS NULL
    AND status IN ('open', 'bidding')
    AND is_haulage_company(auth.uid())
  )
  WITH CHECK (
    -- Allow status to be 'assigned' or remain in open/bidding
    status IN ('assigned', 'open', 'bidding')
    -- Ensure the company is being assigned to the current user
    AND assigned_company_id = auth.uid()
    AND is_haulage_company(auth.uid())
  );
