/*
  # Fix infinite recursion in profiles RLS policy

  1. Problem
    - The "Users can view profiles related to their jobs" policy queries jobs/couriers/bids
      which have their own RLS policies that reference profiles, causing infinite recursion

  2. Fix
    - Drop the recursive policy
    - Create a SECURITY DEFINER helper function that checks job relationships without triggering RLS
    - Create a new policy using the helper function

  3. Security
    - The helper function only returns a boolean (can this user see this profile?)
    - It checks actual job relationships: assigned courier, bidder, counter-offerer
    - No open access to all profiles
*/

DROP POLICY IF EXISTS "Users can view profiles related to their jobs" ON profiles;

CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM jobs j
    JOIN couriers c ON c.id = j.assigned_courier_id
    WHERE c.user_id = target_profile_id
      AND j.customer_user_id = viewer_id
  )
  OR EXISTS (
    SELECT 1 FROM jobs j
    JOIN couriers c ON c.id = j.assigned_courier_id AND c.user_id = viewer_id
    WHERE j.customer_user_id = target_profile_id
  )
  OR EXISTS (
    SELECT 1 FROM bids b
    JOIN jobs j ON j.id = b.job_id
    JOIN couriers c ON c.id = b.courier_id
    WHERE c.user_id = target_profile_id
      AND j.customer_user_id = viewer_id
  )
  OR EXISTS (
    SELECT 1 FROM counter_offers co
    JOIN jobs j ON j.id = co.job_id
    JOIN couriers c ON c.id = co.courier_id
    WHERE c.user_id = target_profile_id
      AND j.customer_user_id = viewer_id
  )
  OR (viewer_id = target_profile_id);
$$;

CREATE POLICY "Users can view profiles related to their jobs"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    public.can_view_profile(auth.uid(), id)
  );

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
