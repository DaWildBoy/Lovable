/*
  # Allow viewing profiles of users involved in shared jobs

  1. Problem
    - Customers cannot see the courier's name on completed deliveries
    - The only SELECT policy on profiles is "Users can view own profile"
    - This means all cross-user profile lookups (courier name, customer name) fail silently

  2. Fix
    - Add a SELECT policy allowing users to see profiles of others involved in their jobs
    - Covers: assigned couriers, bidders, counter-offer participants, and customers of jobs the courier is working

  3. Security
    - Only visible through active job relationships, not open access
*/

CREATE POLICY "Users can view profiles related to their jobs"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id
      WHERE c.user_id = profiles.id
        AND j.customer_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id AND c.user_id = auth.uid()
      WHERE j.customer_user_id = profiles.id
    )
    OR
    EXISTS (
      SELECT 1 FROM bids b
      JOIN jobs j ON j.id = b.job_id
      JOIN couriers c ON c.id = b.courier_id
      WHERE c.user_id = profiles.id
        AND j.customer_user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM counter_offers co
      JOIN jobs j ON j.id = co.job_id
      JOIN couriers c ON c.id = co.courier_id
      WHERE c.user_id = profiles.id
        AND j.customer_user_id = auth.uid()
    )
  );
