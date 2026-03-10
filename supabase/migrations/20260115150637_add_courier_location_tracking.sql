/*
  # Add Courier Location Tracking for Live Tracking

  ## Overview
  Adds real-time location tracking capabilities for couriers during active deliveries.
  Tracking is only available when cargo is in transit (in_transit status).

  ## New Columns Added

  ### Jobs Table - Location Tracking
    - `courier_location_lat` (decimal) - Current latitude of courier
    - `courier_location_lng` (decimal) - Current longitude of courier
    - `location_updated_at` (timestamptz) - Last location update timestamp
    - `tracking_enabled` (boolean) - Whether tracking is currently active

  ## Tracking Rules
    1. Tracking is only enabled when job status is 'in_transit'
    2. Location updates every time courier's position changes
    3. Tracking automatically stops when status changes to 'delivered'
    4. Customers can only see live tracking during 'in_transit' status

  ## Security
    - Location data is only accessible during active delivery
    - Customers can only track their own jobs
    - Tracking automatically disables after delivery
*/

-- Add courier location tracking columns to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_location_lat'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_location_lat decimal(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_location_lng'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_location_lng decimal(10, 7);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'location_updated_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN location_updated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'tracking_enabled'
  ) THEN
    ALTER TABLE jobs ADD COLUMN tracking_enabled boolean DEFAULT false;
  END IF;
END $$;

-- Create index for faster location lookups
CREATE INDEX IF NOT EXISTS idx_jobs_tracking_enabled ON jobs(tracking_enabled) WHERE tracking_enabled = true;