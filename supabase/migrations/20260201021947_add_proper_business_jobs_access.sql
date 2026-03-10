/*
  # Add Proper Business Access to Jobs

  1. Changes
    - Creates a helper function to check if user can view jobs
    - Uses SECURITY DEFINER to avoid recursion
    - Updates jobs policy to use this function
  
  2. Security
    - Only approved couriers and businesses can view open jobs
    - Function is SECURITY DEFINER to break recursion chain
*/

-- Create helper function to check if user can view jobs
CREATE OR REPLACE FUNCTION can_view_open_jobs(user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_approved_courier boolean;
  is_approved_business boolean;
BEGIN
  -- Check if user is an approved courier
  SELECT EXISTS (
    SELECT 1 FROM couriers
    WHERE couriers.user_id = $1
    AND couriers.verification_status = 'approved'
  ) INTO is_approved_courier;
  
  IF is_approved_courier THEN
    RETURN true;
  END IF;
  
  -- Check if user is an approved business
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = $1
    AND profiles.role = 'business'
    AND profiles.business_verification_status = 'approved'
  ) INTO is_approved_business;
  
  RETURN is_approved_business;
END;
$$;

-- Drop the temporary permissive policy
DROP POLICY IF EXISTS "Authenticated users can view open jobs" ON jobs;

-- Create new policy using the helper function
CREATE POLICY "Approved users can view open jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    (status = ANY (ARRAY['open'::text, 'bidding'::text]))
    AND can_view_open_jobs(auth.uid())
  );
