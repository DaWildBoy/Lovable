/*
  # Add haulage assignment columns to jobs table

  1. New Columns on `jobs`
    - `assigned_company_id` (uuid) - FK to profiles, the haulage company assigned
    - `assigned_driver_id` (uuid) - FK to haulage_drivers, the driver assigned
    - `assigned_vehicle_id` (uuid) - FK to haulage_vehicles, the vehicle assigned
    - `assignment_type` (text) - 'direct_courier' or 'haulage_dispatch'
    - `assigned_driver_name` (text) - snapshot of driver name at assignment time
    - `assigned_vehicle_label` (text) - snapshot of vehicle label at assignment time
    - `assigned_company_name` (text) - snapshot of company name at assignment time
    - `assigned_company_logo_url` (text) - snapshot of company logo at assignment time

  2. Indexes
    - idx_jobs_assigned_company on assigned_company_id
    - idx_jobs_assigned_driver on assigned_driver_id
    - idx_jobs_assigned_vehicle on assigned_vehicle_id
    - idx_jobs_assignment_type on assignment_type

  3. Important Notes
    - These columns enable haulage companies to accept jobs and assign their fleet drivers/vehicles
    - Snapshot fields (name, label, logo) avoid expensive joins for display purposes
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_company_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_company_id uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_driver_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_driver_id uuid REFERENCES haulage_drivers(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_vehicle_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_vehicle_id uuid REFERENCES haulage_vehicles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assignment_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assignment_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_driver_name'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_driver_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_vehicle_label'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_vehicle_label text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_company_name'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_company_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_company_logo_url'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_company_logo_url text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_company
  ON jobs(assigned_company_id);

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_driver
  ON jobs(assigned_driver_id);

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_vehicle
  ON jobs(assigned_vehicle_id);

CREATE INDEX IF NOT EXISTS idx_jobs_assignment_type
  ON jobs(assignment_type);
