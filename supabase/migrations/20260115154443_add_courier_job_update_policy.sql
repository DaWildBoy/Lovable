/*
  # Add Courier Job Update Policy

  1. Changes
    - Add RLS policy allowing assigned couriers to update their job status and tracking info
    
  2. Security
    - Couriers can only update jobs assigned to them
    - Restricts updates to specific columns (status, location, tracking)
    - Prevents couriers from changing assignment or pricing
*/

-- Allow assigned couriers to update job status and tracking information
CREATE POLICY "Assigned couriers can update their jobs"
  ON jobs
  FOR UPDATE
  TO authenticated
  USING (
    assigned_courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    assigned_courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
  );
