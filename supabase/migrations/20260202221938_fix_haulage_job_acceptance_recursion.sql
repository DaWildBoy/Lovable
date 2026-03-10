/*
  # Fix Haulage Job Acceptance Infinite Recursion

  ## Problem
  The "Haulage companies can accept unassigned jobs" UPDATE policy on jobs table 
  queries the profiles table to check if user is a haulage company. The profiles 
  table has a SELECT policy that queries the jobs table. This creates a circular 
  dependency causing infinite recursion.

  ## Solution
  Create a SECURITY DEFINER function to check if user is haulage company without 
  triggering RLS policies, breaking the recursion chain.

  ## Changes
  1. Create is_haulage_company() function with SECURITY DEFINER
  2. Update the jobs UPDATE policy to use this function instead of direct profiles query
*/

-- Create helper function to check if user is haulage company
CREATE OR REPLACE FUNCTION is_haulage_company(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  is_haulage boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = $1
    AND profiles.role = 'business'
    AND profiles.business_type = 'haulage'
  ) INTO is_haulage;
  
  RETURN is_haulage;
END;
$$;

-- Drop existing policy
DROP POLICY IF EXISTS "Haulage companies can accept unassigned jobs" ON jobs;

-- Recreate policy using the SECURITY DEFINER function
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
    assigned_company_id = auth.uid()
    AND is_haulage_company(auth.uid())
  );
