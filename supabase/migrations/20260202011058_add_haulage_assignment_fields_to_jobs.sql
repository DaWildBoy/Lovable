/*
  # Add Haulage Assignment Fields to Jobs Table
  
  ## Overview
  Adds fields to track haulage company driver and vehicle assignments directly in the jobs table.
  This supplements the existing job_assignments table for easier querying and historical tracking.
  
  ## New Fields
  - `assigned_company_id` (uuid) - Haulage company that accepted the job
  - `assigned_driver_id` (uuid) - Specific driver assigned to the job
  - `assigned_vehicle_id` (uuid) - Specific vehicle assigned to the job
  - `assignment_type` (text) - Type of assignment: null, 'direct_courier', or 'haulage_dispatch'
  - `assigned_driver_name` (text) - Display snapshot of driver name for history
  - `assigned_vehicle_label` (text) - Display snapshot of vehicle (e.g., "Toyota HiAce • TBH-1234")
  
  ## Usage
  - For regular couriers: assignment_type = 'direct_courier', company/driver/vehicle fields are null
  - For haulage companies: assignment_type = 'haulage_dispatch', all fields populated
  - These fields are set when job is accepted and stored for historical tracking
  
  ## Security
  - No new RLS policies needed - existing job policies cover these fields
  - Fields are nullable to support existing jobs and non-haulage assignments
*/

-- Add haulage assignment fields to jobs table
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
END $$;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_company 
  ON jobs(assigned_company_id);

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_driver 
  ON jobs(assigned_driver_id);

CREATE INDEX IF NOT EXISTS idx_jobs_assigned_vehicle 
  ON jobs(assigned_vehicle_id);

CREATE INDEX IF NOT EXISTS idx_jobs_assignment_type 
  ON jobs(assignment_type);
