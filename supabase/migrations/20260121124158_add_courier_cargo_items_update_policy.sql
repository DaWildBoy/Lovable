/*
  # Add Courier Cargo Items Update Policy

  1. Changes
    - Add RLS policy allowing assigned couriers to update cargo items
    - Couriers can update delivery proof fields for jobs assigned to them
    - This enables marking items as delivered and adding proof of delivery

  2. Security
    - Only couriers assigned to the job can update cargo items
    - Restricted to jobs where they are the assigned_courier_id
*/

CREATE POLICY "Assigned couriers can update cargo items for their jobs"
  ON cargo_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN couriers ON couriers.user_id = auth.uid()
      WHERE jobs.id = cargo_items.job_id
      AND jobs.assigned_courier_id = couriers.id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN couriers ON couriers.user_id = auth.uid()
      WHERE jobs.id = cargo_items.job_id
      AND jobs.assigned_courier_id = couriers.id
    )
  );
