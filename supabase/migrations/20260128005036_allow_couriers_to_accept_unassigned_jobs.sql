/*
  # Allow Couriers to Accept Unassigned Jobs

  1. Purpose
    - Allow couriers to assign themselves to open/unassigned jobs (accept jobs)
    - The existing policy only allows couriers to update jobs already assigned to them
    - This new policy specifically handles the acceptance flow

  2. Changes
    - Add RLS policy for couriers to accept (assign themselves to) unassigned jobs
    - Couriers can only accept jobs where assigned_courier_id is NULL
    - Ensures job status transitions from open/bidding to assigned

  3. Security
    - Couriers can only accept jobs that are not yet assigned (assigned_courier_id IS NULL)
    - Prevents stealing jobs from other couriers
    - Allows setting assigned_courier_id to their own courier ID
    - Allows changing status to 'assigned'
*/

-- Allow couriers to accept unassigned jobs by assigning themselves
CREATE POLICY "Couriers can accept unassigned jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    -- Job must be unassigned
    assigned_courier_id IS NULL
    AND status IN ('open', 'bidding')
    AND EXISTS (
      SELECT 1 FROM couriers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- After update, must be assigned to the courier making the request
    assigned_courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
    AND status = 'assigned'
  );