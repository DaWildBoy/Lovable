/*
  # Add Haulage Company Profile Fields and Onboarding Tracking

  1. New Profile Columns
    - `haulage_business_registration` (text) - Business registration number
    - `haulage_years_in_operation` (integer) - Years operating
    - `haulage_insurance_status` (text) - Active, Expired, None
    - `haulage_insurance_expiry` (date) - Insurance expiry date
    - `haulage_operating_regions` (text[]) - Regions they operate in
    - `haulage_cargo_specialties` (text[]) - Cargo types they specialize in
    - `haulage_company_logo_url` (text) - Company logo
    - `haulage_insurance_certificate_url` (text) - Insurance certificate document
    - `haulage_cargo_insurance_amount` (numeric) - Coverage amount in TTD
    - `haulage_operating_license_number` (text) - Operating license ID
    - `haulage_operating_license_expiry` (date) - License expiry
    - `haulage_dot_number` (text) - DOT or regulatory ID
    - `haulage_safety_rating` (text) - Safety certification level
    - `haulage_service_hours` (text) - Operating hours
    - `haulage_max_fleet_capacity_kg` (integer) - Max fleet capacity
    - `haulage_equipment_types` (text[]) - Equipment types available
    - `haulage_payment_terms` (text) - Payment terms
    - `haulage_tax_id` (text) - Tax identification number
    - `haulage_billing_email` (text) - Billing email
    - `haulage_billing_phone` (text) - Billing phone
    - `haulage_emergency_contact` (text) - Emergency contact
    - `haulage_dispatch_phone` (text) - Dispatch phone
    - `haulage_preferred_contact_method` (text) - Preferred contact method
    - `haulage_service_highlights` (text) - Service description
    - `haulage_on_time_delivery_rate` (numeric) - Performance metric
    - `haulage_incident_rate` (numeric) - Performance metric
    - `haulage_onboarding_completed` (boolean) - Whether onboarding wizard is complete

  2. New Tables
    - `haulage_drivers` - Drivers belonging to haulage companies
    - `haulage_vehicles` - Vehicles belonging to haulage companies
    - `job_assignments` - Driver/vehicle assignments for jobs

  3. Security
    - RLS enabled on all new tables
    - Companies can only manage their own drivers and vehicles
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

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_insurance_certificate_url text,
ADD COLUMN IF NOT EXISTS haulage_cargo_insurance_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS haulage_operating_license_number text,
ADD COLUMN IF NOT EXISTS haulage_operating_license_expiry date,
ADD COLUMN IF NOT EXISTS haulage_dot_number text,
ADD COLUMN IF NOT EXISTS haulage_safety_rating text;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_service_hours text DEFAULT 'Business Hours',
ADD COLUMN IF NOT EXISTS haulage_max_fleet_capacity_kg integer,
ADD COLUMN IF NOT EXISTS haulage_equipment_types text[];

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_payment_terms text DEFAULT 'Immediate',
ADD COLUMN IF NOT EXISTS haulage_tax_id text,
ADD COLUMN IF NOT EXISTS haulage_billing_email text,
ADD COLUMN IF NOT EXISTS haulage_billing_phone text;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_emergency_contact text,
ADD COLUMN IF NOT EXISTS haulage_dispatch_phone text,
ADD COLUMN IF NOT EXISTS haulage_preferred_contact_method text DEFAULT 'App';

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_service_highlights text;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_on_time_delivery_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS haulage_incident_rate numeric(5,2) DEFAULT 0;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_onboarding_completed boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_haulage_business_type ON profiles(business_type) WHERE business_type = 'haulage';

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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can view own drivers' AND tablename = 'haulage_drivers') THEN
    CREATE POLICY "Company can view own drivers"
      ON haulage_drivers FOR SELECT TO authenticated
      USING (auth.uid() = company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can insert own drivers' AND tablename = 'haulage_drivers') THEN
    CREATE POLICY "Company can insert own drivers"
      ON haulage_drivers FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can update own drivers' AND tablename = 'haulage_drivers') THEN
    CREATE POLICY "Company can update own drivers"
      ON haulage_drivers FOR UPDATE TO authenticated
      USING (auth.uid() = company_id) WITH CHECK (auth.uid() = company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can delete own drivers' AND tablename = 'haulage_drivers') THEN
    CREATE POLICY "Company can delete own drivers"
      ON haulage_drivers FOR DELETE TO authenticated
      USING (auth.uid() = company_id);
  END IF;
END $$;

-- RLS Policies for haulage_vehicles
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can view own vehicles' AND tablename = 'haulage_vehicles') THEN
    CREATE POLICY "Company can view own vehicles"
      ON haulage_vehicles FOR SELECT TO authenticated
      USING (auth.uid() = company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can insert own vehicles' AND tablename = 'haulage_vehicles') THEN
    CREATE POLICY "Company can insert own vehicles"
      ON haulage_vehicles FOR INSERT TO authenticated
      WITH CHECK (auth.uid() = company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can update own vehicles' AND tablename = 'haulage_vehicles') THEN
    CREATE POLICY "Company can update own vehicles"
      ON haulage_vehicles FOR UPDATE TO authenticated
      USING (auth.uid() = company_id) WITH CHECK (auth.uid() = company_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can delete own vehicles' AND tablename = 'haulage_vehicles') THEN
    CREATE POLICY "Company can delete own vehicles"
      ON haulage_vehicles FOR DELETE TO authenticated
      USING (auth.uid() = company_id);
  END IF;
END $$;

-- RLS Policies for job_assignments
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can view assignments for their jobs' AND tablename = 'job_assignments') THEN
    CREATE POLICY "Company can view assignments for their jobs"
      ON job_assignments FOR SELECT TO authenticated
      USING (
        auth.uid() = company_id OR
        EXISTS (
          SELECT 1 FROM jobs
          WHERE jobs.id = job_assignments.job_id
          AND (jobs.customer_user_id = auth.uid() OR jobs.assigned_courier_id = auth.uid())
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can insert assignments for their accepted jobs' AND tablename = 'job_assignments') THEN
    CREATE POLICY "Company can insert assignments for their accepted jobs"
      ON job_assignments FOR INSERT TO authenticated
      WITH CHECK (
        auth.uid() = company_id AND
        EXISTS (
          SELECT 1 FROM jobs
          WHERE jobs.id = job_assignments.job_id
          AND jobs.assigned_courier_id = auth.uid()
        )
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Company can update own job assignments' AND tablename = 'job_assignments') THEN
    CREATE POLICY "Company can update own job assignments"
      ON job_assignments FOR UPDATE TO authenticated
      USING (auth.uid() = company_id) WITH CHECK (auth.uid() = company_id);
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_haulage_drivers_company ON haulage_drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_haulage_drivers_active ON haulage_drivers(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_haulage_vehicles_company ON haulage_vehicles(company_id);
CREATE INDEX IF NOT EXISTS idx_haulage_vehicles_active ON haulage_vehicles(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_job_assignments_company ON job_assignments(company_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_driver ON job_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_job_assignments_vehicle ON job_assignments(vehicle_id);
