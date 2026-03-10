/*
  # Add Haulage Fleet Management Features

  ## Overview
  Adds haulage company fleet management including drivers, vehicles, and job assignments.
  These features are PROFILE-LEVEL and JOB-ACCEPTANCE-LEVEL ONLY and do not affect
  existing delivery logic, routing, or job creation.

  ## New Tables

  ### `haulage_drivers`
  - `id` (uuid, primary key)
  - `company_id` (uuid, references profiles) - Haulage company that owns this driver
  - `full_name` (text) - Driver's full name
  - `phone` (text) - Driver's contact number
  - `license_type` (text) - Optional license classification
  - `is_active` (boolean) - Whether driver is currently active
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `haulage_vehicles`
  - `id` (uuid, primary key)
  - `company_id` (uuid, references profiles) - Haulage company that owns this vehicle
  - `vehicle_name` (text) - Unit number or name
  - `plate_number` (text) - License plate
  - `vehicle_type` (text) - Box Truck, Flatbed, Reefer, Tipper, Lowboy, etc.
  - `capacity_kg` (numeric) - Max payload capacity
  - `special_equipment` (text) - Liftgate, crane, straps, tarps, etc.
  - `is_active` (boolean) - Whether vehicle is currently active
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `job_assignments`
  - `job_id` (uuid, primary key, references jobs) - One assignment per job
  - `company_id` (uuid, references profiles) - Haulage company
  - `driver_id` (uuid, references haulage_drivers) - Assigned driver
  - `vehicle_id` (uuid, references haulage_vehicles) - Assigned vehicle
  - `assigned_by_user_id` (uuid, references profiles) - Who made the assignment
  - `assigned_at` (timestamptz) - When assignment was made
  - `reassigned_at` (timestamptz) - Last reassignment timestamp
  - `reassignment_notes` (text) - Reason for reassignment

  ## Profile Extensions
  Adds optional haulage company fields to existing profiles table:
  - `haulage_business_registration` (text) - Business registration number
  - `haulage_years_in_operation` (integer) - Years operating
  - `haulage_insurance_status` (text) - Active, Expired, None
  - `haulage_insurance_expiry` (date) - Insurance expiry date
  - `haulage_operating_regions` (text[]) - Regions they operate in
  - `haulage_cargo_specialties` (text[]) - Cargo types they specialize in
  - `haulage_company_logo_url` (text) - Company logo

  ## Security
  - RLS enabled on all new tables
  - Haulage companies can only access their own drivers/vehicles
  - Job assignments visible to job participants
  - No automated job modifications

  ## Important Notes
  - Driver/vehicle assignment is REQUIRED before job acceptance
  - Assignments persist through job lifecycle
  - These features do NOT modify existing delivery or routing logic
  - Retail, courier, and customer experiences remain unchanged
*/

-- Add haulage-specific fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'haulage_business_registration'
  ) THEN
    ALTER TABLE profiles ADD COLUMN haulage_business_registration text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'haulage_years_in_operation'
  ) THEN
    ALTER TABLE profiles ADD COLUMN haulage_years_in_operation integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'haulage_insurance_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN haulage_insurance_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'haulage_insurance_expiry'
  ) THEN
    ALTER TABLE profiles ADD COLUMN haulage_insurance_expiry date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'haulage_operating_regions'
  ) THEN
    ALTER TABLE profiles ADD COLUMN haulage_operating_regions text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'haulage_cargo_specialties'
  ) THEN
    ALTER TABLE profiles ADD COLUMN haulage_cargo_specialties text[];
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'haulage_company_logo_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN haulage_company_logo_url text;
  END IF;
END $$;

-- Create haulage_drivers table
CREATE TABLE IF NOT EXISTS haulage_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  phone text,
  license_type text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create haulage_vehicles table
CREATE TABLE IF NOT EXISTS haulage_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vehicle_name text NOT NULL,
  plate_number text,
  vehicle_type text NOT NULL,
  capacity_kg numeric,
  special_equipment text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create job_assignments table
CREATE TABLE IF NOT EXISTS job_assignments (
  job_id uuid PRIMARY KEY REFERENCES jobs(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES haulage_drivers(id) ON DELETE RESTRICT,
  vehicle_id uuid NOT NULL REFERENCES haulage_vehicles(id) ON DELETE RESTRICT,
  assigned_by_user_id uuid NOT NULL REFERENCES profiles(id),
  assigned_at timestamptz DEFAULT now(),
  reassigned_at timestamptz,
  reassignment_notes text
);

-- Enable RLS on all new tables
ALTER TABLE haulage_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE haulage_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for haulage_drivers
CREATE POLICY "Company can view own drivers"
  ON haulage_drivers FOR SELECT
  TO authenticated
  USING (auth.uid() = company_id);

CREATE POLICY "Company can insert own drivers"
  ON haulage_drivers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Company can update own drivers"
  ON haulage_drivers FOR UPDATE
  TO authenticated
  USING (auth.uid() = company_id)
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Company can delete own drivers"
  ON haulage_drivers FOR DELETE
  TO authenticated
  USING (auth.uid() = company_id);

-- RLS Policies for haulage_vehicles
CREATE POLICY "Company can view own vehicles"
  ON haulage_vehicles FOR SELECT
  TO authenticated
  USING (auth.uid() = company_id);

CREATE POLICY "Company can insert own vehicles"
  ON haulage_vehicles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Company can update own vehicles"
  ON haulage_vehicles FOR UPDATE
  TO authenticated
  USING (auth.uid() = company_id)
  WITH CHECK (auth.uid() = company_id);

CREATE POLICY "Company can delete own vehicles"
  ON haulage_vehicles FOR DELETE
  TO authenticated
  USING (auth.uid() = company_id);

-- RLS Policies for job_assignments
CREATE POLICY "Company can view assignments for their jobs"
  ON job_assignments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = company_id OR
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_assignments.job_id
      AND (jobs.customer_user_id = auth.uid() OR jobs.assigned_courier_id = auth.uid())
    )
  );

CREATE POLICY "Company can insert assignments for their accepted jobs"
  ON job_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = company_id AND
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_assignments.job_id
      AND jobs.assigned_courier_id = auth.uid()
    )
  );

CREATE POLICY "Company can update own job assignments"
  ON job_assignments FOR UPDATE
  TO authenticated
  USING (auth.uid() = company_id)
  WITH CHECK (auth.uid() = company_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_haulage_drivers_company 
  ON haulage_drivers(company_id);

CREATE INDEX IF NOT EXISTS idx_haulage_drivers_active 
  ON haulage_drivers(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_haulage_vehicles_company 
  ON haulage_vehicles(company_id);

CREATE INDEX IF NOT EXISTS idx_haulage_vehicles_active 
  ON haulage_vehicles(company_id, is_active);

CREATE INDEX IF NOT EXISTS idx_job_assignments_company 
  ON job_assignments(company_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_driver 
  ON job_assignments(driver_id);

CREATE INDEX IF NOT EXISTS idx_job_assignments_vehicle 
  ON job_assignments(vehicle_id);
