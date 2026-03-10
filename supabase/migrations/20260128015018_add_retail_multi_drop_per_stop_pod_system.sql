/*
  # Retail Multi-Drop Per-Stop POD System

  ## Overview
  This migration adds comprehensive per-stop tracking and proof-of-delivery (POD)
  for retail multi-drop jobs. Each delivery stop can have its own POD requirements
  and completion status.

  ## 1. New Tables

  ### delivery_stops
  Tracks individual delivery stops for multi-drop jobs:
    - `id` (uuid, primary key)
    - `job_id` (uuid, foreign key to jobs)
    - `stop_index` (integer) - Order of this stop in the route (0=pickup, 1+=dropoffs)
    - `stop_type` (text) - PICKUP or DROPOFF
    - `location_text` (text) - Human-readable address
    - `location_lat` (numeric, nullable) - Latitude
    - `location_lng` (numeric, nullable) - Longitude
    - `contact_name` (text, nullable)
    - `contact_phone` (text, nullable)
    - `status` (text) - NOT_STARTED, ENROUTE, ARRIVED, COMPLETED
    - `arrived_at` (timestamptz, nullable)
    - `completed_at` (timestamptz, nullable)
    - `notes` (text, nullable)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ### pod_stops
  Per-stop proof of delivery records:
    - `id` (uuid, primary key)
    - `stop_id` (uuid, foreign key to delivery_stops, unique)
    - `job_id` (uuid, foreign key to jobs) - Denormalized for easier queries
    - `required_type` (text) - NONE, PHOTO, SIGNATURE, PHOTO_AND_SIGNATURE
    - `status` (text) - NOT_REQUIRED, REQUIRED, PENDING, COMPLETED
    - `photo_urls` (text array)
    - `signature_image_url` (text, nullable)
    - `signed_by_name` (text, nullable)
    - `recipient_name` (text, nullable) - Name of person who received delivery
    - `completed_at` (timestamptz, nullable)
    - `completed_by_user_id` (uuid, nullable)
    - `notes` (text, nullable) - Delivery notes from courier
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## 2. Security (RLS)
  - Couriers can read/update stops and POD for jobs assigned to them
  - Job creators (retail) can read stops and POD for their jobs
  - Admins can read/update all stops and POD records

  ## 3. Important Notes
  - This system is designed primarily for retail multi-drop jobs
  - For non-retail jobs, the existing job-level POD system remains in use
  - Per-stop POD inherits requirements from job.proof_of_delivery_required unless overridden
  - All cargo items can be linked to specific stops via cargo_items.assigned_stop_id
*/

-- Create delivery_stops table
CREATE TABLE IF NOT EXISTS delivery_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stop_index integer NOT NULL,
  stop_type text NOT NULL CHECK (stop_type IN ('PICKUP', 'DROPOFF')),
  location_text text NOT NULL,
  location_lat numeric,
  location_lng numeric,
  contact_name text,
  contact_phone text,
  status text NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'ENROUTE', 'ARRIVED', 'COMPLETED')),
  arrived_at timestamptz,
  completed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT delivery_stops_job_stop_unique UNIQUE (job_id, stop_index)
);

-- Create pod_stops table
CREATE TABLE IF NOT EXISTS pod_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stop_id uuid UNIQUE NOT NULL REFERENCES delivery_stops(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  required_type text NOT NULL DEFAULT 'NONE' CHECK (required_type IN ('NONE', 'PHOTO', 'SIGNATURE', 'PHOTO_AND_SIGNATURE')),
  status text NOT NULL DEFAULT 'NOT_REQUIRED' CHECK (status IN ('NOT_REQUIRED', 'REQUIRED', 'PENDING', 'COMPLETED')),
  photo_urls text[] DEFAULT ARRAY[]::text[],
  signature_image_url text,
  signed_by_name text,
  recipient_name text,
  completed_at timestamptz,
  completed_by_user_id uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE delivery_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE pod_stops ENABLE ROW LEVEL SECURITY;

-- RLS Policies for delivery_stops

-- Couriers can read stops for jobs assigned to them
CREATE POLICY "Couriers can read stops for assigned jobs"
  ON delivery_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Couriers can update stops for jobs assigned to them
CREATE POLICY "Couriers can update stops for assigned jobs"
  ON delivery_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Job creators can read stops for their jobs
CREATE POLICY "Job creators can read stops"
  ON delivery_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Job creators can insert stops for their jobs (when creating job)
CREATE POLICY "Job creators can insert stops"
  ON delivery_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Admins can read all stops
CREATE POLICY "Admins can read all stops"
  ON delivery_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update all stops
CREATE POLICY "Admins can update all stops"
  ON delivery_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- RLS Policies for pod_stops

-- Couriers can read POD stops for jobs assigned to them
CREATE POLICY "Couriers can read POD stops for assigned jobs"
  ON pod_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Couriers can update POD stops for jobs assigned to them
CREATE POLICY "Couriers can update POD stops for assigned jobs"
  ON pod_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Couriers can insert POD stops for jobs assigned to them
CREATE POLICY "Couriers can insert POD stops for assigned jobs"
  ON pod_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Job creators can read POD stops for their jobs
CREATE POLICY "Job creators can read POD stops"
  ON pod_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Job creators can insert POD stops (when creating job)
CREATE POLICY "Job creators can insert POD stops"
  ON pod_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Admins can read all POD stops
CREATE POLICY "Admins can read all POD stops"
  ON pod_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update all POD stops
CREATE POLICY "Admins can update all POD stops"
  ON pod_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can insert all POD stops
CREATE POLICY "Admins can insert all POD stops"
  ON pod_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_delivery_stops_job_id ON delivery_stops(job_id);
CREATE INDEX IF NOT EXISTS idx_delivery_stops_status ON delivery_stops(status);
CREATE INDEX IF NOT EXISTS idx_delivery_stops_stop_index ON delivery_stops(job_id, stop_index);
CREATE INDEX IF NOT EXISTS idx_pod_stops_stop_id ON pod_stops(stop_id);
CREATE INDEX IF NOT EXISTS idx_pod_stops_job_id ON pod_stops(job_id);
CREATE INDEX IF NOT EXISTS idx_pod_stops_status ON pod_stops(status);

-- Function to auto-update updated_at for delivery_stops
CREATE OR REPLACE FUNCTION update_delivery_stops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at for delivery_stops
DROP TRIGGER IF EXISTS delivery_stops_updated_at ON delivery_stops;
CREATE TRIGGER delivery_stops_updated_at
  BEFORE UPDATE ON delivery_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_delivery_stops_updated_at();

-- Function to auto-update updated_at for pod_stops
CREATE OR REPLACE FUNCTION update_pod_stops_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at for pod_stops
DROP TRIGGER IF EXISTS pod_stops_updated_at ON pod_stops;
CREATE TRIGGER pod_stops_updated_at
  BEFORE UPDATE ON pod_stops
  FOR EACH ROW
  EXECUTE FUNCTION update_pod_stops_updated_at();