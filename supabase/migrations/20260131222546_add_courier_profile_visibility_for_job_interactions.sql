/*
  # Allow viewing courier profiles during job interactions

  1. Changes
    - Add SELECT policy to allow customers to view courier profiles when:
      - The courier has bid on their job
      - The courier has made a counter offer on their job  
      - The courier is assigned to their job
      - The courier is tracking their job
    - Add SELECT policy to allow couriers to view customer profiles when:
      - They have bid on the customer's job
      - They have made a counter offer on the customer's job
      - They are assigned to the customer's job

  2. Security
    - Users can only see profiles related to their active job interactions
    - No open access to all profiles
*/

-- Allow customers to view courier profiles involved in their jobs
CREATE POLICY "Users can view profiles of couriers on their jobs"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Allow viewing courier profiles who have bid on user's jobs
    EXISTS (
      SELECT 1 FROM bids b
      JOIN jobs j ON j.id = b.job_id
      JOIN couriers c ON c.id = b.courier_id
      WHERE c.user_id = profiles.id
        AND j.customer_user_id = auth.uid()
        AND b.status = 'active'
    )
    OR
    -- Allow viewing courier profiles who have counter offered on user's jobs
    EXISTS (
      SELECT 1 FROM counter_offers co
      JOIN jobs j ON j.id = co.job_id
      JOIN couriers c ON c.id = co.courier_id
      WHERE c.user_id = profiles.id
        AND j.customer_user_id = auth.uid()
        AND co.status IN ('pending', 'countered')
    )
    OR
    -- Allow viewing courier profile who is assigned to user's job
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id
      WHERE c.user_id = profiles.id
        AND j.customer_user_id = auth.uid()
    )
    OR
    -- Allow viewing customer profile if courier has bid on their job
    EXISTS (
      SELECT 1 FROM bids b
      JOIN jobs j ON j.id = b.job_id
      JOIN couriers c ON c.user_id = auth.uid()
      WHERE j.customer_user_id = profiles.id
        AND b.courier_id = c.id
        AND b.status = 'active'
    )
    OR
    -- Allow viewing customer profile if courier has counter offered on their job
    EXISTS (
      SELECT 1 FROM counter_offers co
      JOIN jobs j ON j.id = co.job_id
      JOIN couriers c ON c.user_id = auth.uid()
      WHERE j.customer_user_id = profiles.id
        AND co.courier_id = c.id
        AND co.status IN ('pending', 'countered')
    )
    OR
    -- Allow viewing customer profile if courier is assigned to their job
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id AND c.user_id = auth.uid()
      WHERE j.customer_user_id = profiles.id
    )
  );
