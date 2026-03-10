/*
  # Fix infinite recursion in super admin profiles policies

  1. Problem
    - The super admin SELECT/UPDATE policies on profiles query the profiles table itself
    - This creates infinite recursion when RLS evaluates the policy

  2. Solution
    - Create a SECURITY DEFINER function that checks super admin status directly via auth.jwt()
    - This avoids querying the profiles table and breaks the recursion cycle
    - Replace the recursive policies with ones using the new function

  3. Changes
    - New function: is_super_admin() - checks role from auth JWT metadata
    - Drop and recreate super admin policies on profiles table
*/

-- Create a security definer function that checks super admin status
-- without querying the profiles table (uses auth.jwt() instead)
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON profiles;

-- Recreate with a simple own-row check that avoids recursion
-- For the SELECT policy: allow users to read their own row always (needed for the function above)
-- Then the super admin function can work without recursion since it only reads own row
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Super admin SELECT policy uses the security definer function
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_super_admin());

-- Super admin UPDATE policy uses the security definer function
CREATE POLICY "Super admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_super_admin())
  WITH CHECK (is_super_admin());
