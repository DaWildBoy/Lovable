/*
  # Fix Haulage Job Acceptance - Final Solution

  ## Problem
  Haulage companies are getting RLS policy violations when trying to accept jobs.
  The issue is that the WITH CHECK clause is being evaluated against the new row
  and failing.

  ## Solution  
  1. Make the WITH CHECK clause less restrictive by only checking the security-critical
     fields while allowing business logic fields to be set
  2. Ensure the policy allows setting status to 'assigned' and all assignment fields

  ## Changes
  - Drop and recreate the haulage job acceptance policy with a clearer WITH CHECK
  - Allow status to be set to 'assigned' explicitly
  - Allow all assignment-related fields to be updated

  ## Security
  - USING: Verifies job is unassigned and user is a haulage company
  - WITH CHECK: Ensures assigned_company_id is set to the current user
*/

-- Drop existing haulage assignment policy
DROP POLICY IF EXISTS "Haulage companies can assign drivers to unassigned jobs" ON jobs;

-- Recreate with explicit permissions
CREATE POLICY "Haulage companies can accept and assign jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    -- Job must be unassigned
    assigned_courier_id IS NULL
    AND assigned_company_id IS NULL
    AND status IN ('open', 'bidding')
    -- User must be a haulage company
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'business'
      AND profiles.business_type = 'haulage'
    )
  )
  WITH CHECK (
    -- After update, job must be assigned to this haulage company
    assigned_company_id = auth.uid()
    -- And status must be 'assigned' (or remain in open/bidding if partial update)
    AND (status = 'assigned' OR status IN ('open', 'bidding'))
  );
