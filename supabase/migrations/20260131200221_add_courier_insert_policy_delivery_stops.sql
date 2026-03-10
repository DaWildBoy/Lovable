/*
  # Add Courier INSERT Policy for Delivery Stops

  1. Changes
    - Add INSERT policy for delivery_stops table allowing couriers to insert stops for jobs assigned to them
    - This enables backward compatibility where missing delivery_stops can be created on-the-fly
  
  2. Security
    - Policy checks that the job is assigned to the courier making the request
    - Only authenticated couriers can insert stops for their own jobs
*/

-- Allow couriers to insert delivery_stops for jobs assigned to them
CREATE POLICY "Couriers can insert stops for assigned jobs"
  ON delivery_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );
