/*
  # Fix Infinite Recursion in Profiles RLS Policy

  1. Changes
    - Drop the complex "Users can view profiles of couriers on their jobs" policy that causes infinite recursion
    - Replace with simpler policies that avoid circular dependencies
    - Allow users to view courier profiles directly through the couriers table instead

  2. Security
    - Users can still view their own profile
    - Users can view profiles when they have a direct relationship through jobs
    - Removes circular dependency between profiles and jobs tables
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view profiles of couriers on their jobs" ON profiles;

-- Create a simpler policy that allows viewing profiles of users involved in the same job
-- This uses a direct check without recursing back through the jobs table policies
CREATE POLICY "Users can view profiles for job interactions"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- User can view their own profile
    auth.uid() = id
    OR
    -- User can view profiles of couriers who have bid on their jobs
    EXISTS (
      SELECT 1 FROM bids b
      JOIN couriers c ON c.id = b.courier_id
      WHERE c.user_id = profiles.id
      AND b.job_id IN (
        SELECT id FROM jobs WHERE customer_user_id = auth.uid()
      )
    )
    OR
    -- User can view profiles of customers whose jobs they've bid on
    EXISTS (
      SELECT 1 FROM bids b
      JOIN couriers c ON c.user_id = auth.uid()
      WHERE b.courier_id = c.id
      AND b.job_id IN (
        SELECT id FROM jobs WHERE customer_user_id = profiles.id
      )
    )
    OR
    -- User can view profiles of their assigned courier
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id
      WHERE c.user_id = profiles.id
      AND j.customer_user_id = auth.uid()
    )
    OR
    -- Courier can view profile of customer who assigned them
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id AND c.user_id = auth.uid()
      WHERE j.customer_user_id = profiles.id
    )
  );
