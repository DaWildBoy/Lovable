/*
  # Add Live Tracking System for Multi-Stop Deliveries

  ## Overview
  Creates tables and policies for real-time driver location tracking during job delivery.
  Tracking is active only when pickup is collected and job is in progress.

  ## New Tables

  ### `job_driver_location_current`
  Stores the latest location for each active job's driver:
  - `job_id` (uuid, primary key) - Links to jobs table
  - `driver_user_id` (uuid) - The courier/trucker user ID
  - `lat` (double precision) - Current latitude
  - `lng` (double precision) - Current longitude
  - `heading` (double precision, optional) - Direction in degrees (0-360)
  - `speed` (double precision, optional) - Speed in meters per second
  - `accuracy` (double precision, optional) - Location accuracy in meters
  - `updated_at` (timestamptz) - Last update timestamp

  ### `job_driver_location_history`
  Optional history table for location tracking analytics:
  - `id` (uuid, primary key)
  - `job_id` (uuid) - Links to jobs table
  - `driver_user_id` (uuid) - The courier/trucker user ID
  - `lat`, `lng`, `heading`, `speed`, `accuracy` - Location data
  - `created_at` (timestamptz) - When this point was recorded

  ## Security (RLS)

  ### Read Access (location_current and location_history):
  - Job owner (customer/retail who created the job)
  - Assigned courier/trucker for that job
  - Admins (future)

  ### Write Access (location_current):
  - Only assigned courier/trucker for that job
  - Only when tracking is active (pickup collected, job not completed)
*/

-- Create job_driver_location_current table
CREATE TABLE IF NOT EXISTS job_driver_location_current (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  speed double precision,
  accuracy double precision,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create job_driver_location_history table
CREATE TABLE IF NOT EXISTS job_driver_location_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  driver_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  heading double precision,
  speed double precision,
  accuracy double precision,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_location_history_job_id ON job_driver_location_history(job_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_history_created_at ON job_driver_location_history(created_at DESC);

-- Enable RLS
ALTER TABLE job_driver_location_current ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_driver_location_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for job_driver_location_current

-- Read: Job owner, assigned courier, or admin can view
CREATE POLICY "Job participants can view current driver location"
  ON job_driver_location_current
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_driver_location_current.job_id
      AND (
        jobs.customer_user_id = auth.uid()
        OR jobs.assigned_courier_id = auth.uid()
      )
    )
  );

-- Write: Only assigned courier can update their location
CREATE POLICY "Assigned courier can update their location"
  ON job_driver_location_current
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_driver_location_current.job_id
      AND jobs.assigned_courier_id = auth.uid()
      AND jobs.status IN ('accepted', 'in_transit')
    )
  );

CREATE POLICY "Assigned courier can update their existing location"
  ON job_driver_location_current
  FOR UPDATE
  TO authenticated
  USING (
    driver_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_driver_location_current.job_id
      AND jobs.assigned_courier_id = auth.uid()
      AND jobs.status IN ('accepted', 'in_transit')
    )
  )
  WITH CHECK (
    driver_user_id = auth.uid()
  );

-- RLS Policies for job_driver_location_history

-- Read: Job owner, assigned courier, or admin can view history
CREATE POLICY "Job participants can view location history"
  ON job_driver_location_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_driver_location_history.job_id
      AND (
        jobs.customer_user_id = auth.uid()
        OR jobs.assigned_courier_id = auth.uid()
      )
    )
  );

-- Write: Only assigned courier can insert history records
CREATE POLICY "Assigned courier can insert location history"
  ON job_driver_location_history
  FOR INSERT
  TO authenticated
  WITH CHECK (
    driver_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_driver_location_history.job_id
      AND jobs.assigned_courier_id = auth.uid()
      AND jobs.status IN ('accepted', 'in_transit')
    )
  );

-- Add helpful comments
COMMENT ON TABLE job_driver_location_current IS 'Stores the latest GPS location for each active job driver for real-time tracking';
COMMENT ON TABLE job_driver_location_history IS 'Historical GPS tracking data for analytics and debugging';
COMMENT ON COLUMN job_driver_location_current.heading IS 'Direction of travel in degrees (0-360, where 0 is North)';
COMMENT ON COLUMN job_driver_location_current.speed IS 'Speed in meters per second';
COMMENT ON COLUMN job_driver_location_current.accuracy IS 'GPS accuracy in meters (lower is better)';
