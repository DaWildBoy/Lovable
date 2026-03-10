/*
  # Allow Couriers to Insert POD Records

  1. Purpose
    - Allow couriers to create POD records for jobs assigned to them
    - This is needed when a courier accepts a job that doesn't have a POD record yet

  2. Security
    - Couriers can only insert POD records for jobs assigned to them
    - Maintains data integrity and access control
*/

-- Allow couriers to insert POD records for jobs assigned to them
CREATE POLICY "Couriers can insert POD records for assigned jobs"
  ON proof_of_delivery FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = proof_of_delivery.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );