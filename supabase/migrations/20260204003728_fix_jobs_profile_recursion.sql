/*
  # Fix Circular Dependency Between Jobs and Profiles

  1. Changes
    - Remove profile table reference from jobs RLS policy
    - Use a simpler check that doesn't cause recursion
    - Haulage companies check is moved to application layer

  2. Security
    - Maintains same security posture
    - Prevents infinite recursion between jobs and profiles tables
*/

-- Drop the problematic haulage policy
DROP POLICY IF EXISTS "Haulage companies can view assigned jobs" ON jobs;

-- Recreate without the profiles table reference
-- The business_type check can be done at the application layer
-- At the RLS level, we just need to check if they're the assigned company
CREATE POLICY "Haulage companies can view assigned jobs"
  ON jobs
  FOR SELECT
  TO authenticated
  USING (assigned_company_id = auth.uid());
