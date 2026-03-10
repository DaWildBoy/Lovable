/*
  # Add Retail Profile Features

  ## Overview
  Adds retail-specific profile enhancements including saved locations, delivery templates,
  preferred couriers, and retail defaults. These features are PROFILE-LEVEL ONLY and do not
  affect existing delivery logic, job creation, or routing systems.

  ## New Tables

  ### `retail_saved_locations`
  - `id` (uuid, primary key)
  - `profile_id` (uuid, references profiles) - Owner of the location
  - `location_name` (text) - User-friendly label (e.g., "Main Warehouse")
  - `address_text` (text) - Full address
  - `latitude` (numeric) - GPS coordinates
  - `longitude` (numeric) - GPS coordinates
  - `location_notes` (text) - Gate codes, loading bay info, business hours, etc.
  - `is_default_pickup` (boolean) - Quick selection flag
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `retail_delivery_templates`
  - `id` (uuid, primary key)
  - `profile_id` (uuid, references profiles) - Template owner
  - `template_name` (text) - User-friendly name
  - `pickup_locations` (jsonb) - Array of pickup location objects
  - `dropoff_locations` (jsonb) - Array of dropoff location objects
  - `cargo_items` (jsonb) - Array of cargo item configurations
  - `pod_requirements` (text) - Photo, Signature, Both, None
  - `delivery_order_preference` (text) - Sequential, Flexible
  - `special_requirements` (jsonb) - Fragile, cover, heavy lift, etc.
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `retail_preferred_couriers`
  - `id` (uuid, primary key)
  - `retail_profile_id` (uuid, references profiles) - Retail user
  - `courier_profile_id` (uuid, references profiles) - Preferred courier
  - `notes` (text) - Why preferred (optional)
  - `created_at` (timestamptz)

  ### `retail_defaults`
  - `profile_id` (uuid, primary key, references profiles) - One row per retail user
  - `default_pod_requirement` (text) - Photo, Signature, Both, None
  - `default_delivery_order` (text) - Sequential, Flexible
  - `default_cargo_handling_notes` (text)
  - `default_pickup_location_id` (uuid) - Reference to saved location
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Profile Extensions
  Adds optional retail company fields to existing profiles table:
  - `retail_company_logo_url` (text) - Company logo
  - `retail_primary_contact_name` (text) - Primary contact
  - `retail_business_phone` (text) - Business phone
  - `retail_business_email` (text) - Business email

  ## Security
  - RLS enabled on all new tables
  - Users can only access their own retail data
  - No cross-user data access
  - No automated job modifications

  ## Important Notes
  - These features are OPTIONAL and INFORMATIONAL
  - They do NOT automatically apply to job creation
  - They do NOT modify existing delivery logic
  - They are only visible/accessible to retail accounts (business_type checks in UI)
*/

-- Add retail-specific fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'retail_company_logo_url'
  ) THEN
    ALTER TABLE profiles ADD COLUMN retail_company_logo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'retail_primary_contact_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN retail_primary_contact_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'retail_business_phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN retail_business_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'retail_business_email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN retail_business_email text;
  END IF;
END $$;

-- Create retail_saved_locations table
CREATE TABLE IF NOT EXISTS retail_saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  location_name text NOT NULL,
  address_text text NOT NULL,
  latitude numeric,
  longitude numeric,
  location_notes text,
  is_default_pickup boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create retail_delivery_templates table
CREATE TABLE IF NOT EXISTS retail_delivery_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  pickup_locations jsonb DEFAULT '[]'::jsonb,
  dropoff_locations jsonb DEFAULT '[]'::jsonb,
  cargo_items jsonb DEFAULT '[]'::jsonb,
  pod_requirements text DEFAULT 'Photo',
  delivery_order_preference text DEFAULT 'Sequential',
  special_requirements jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create retail_preferred_couriers table
CREATE TABLE IF NOT EXISTS retail_preferred_couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  retail_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  courier_profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(retail_profile_id, courier_profile_id)
);

-- Create retail_defaults table
CREATE TABLE IF NOT EXISTS retail_defaults (
  profile_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  default_pod_requirement text DEFAULT 'Photo',
  default_delivery_order text DEFAULT 'Sequential',
  default_cargo_handling_notes text,
  default_pickup_location_id uuid REFERENCES retail_saved_locations(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE retail_saved_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_delivery_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_preferred_couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_defaults ENABLE ROW LEVEL SECURITY;

-- RLS Policies for retail_saved_locations
CREATE POLICY "Users can view own saved locations"
  ON retail_saved_locations FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own saved locations"
  ON retail_saved_locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own saved locations"
  ON retail_saved_locations FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete own saved locations"
  ON retail_saved_locations FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- RLS Policies for retail_delivery_templates
CREATE POLICY "Users can view own delivery templates"
  ON retail_delivery_templates FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own delivery templates"
  ON retail_delivery_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own delivery templates"
  ON retail_delivery_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can delete own delivery templates"
  ON retail_delivery_templates FOR DELETE
  TO authenticated
  USING (auth.uid() = profile_id);

-- RLS Policies for retail_preferred_couriers
CREATE POLICY "Retail users can view own preferred couriers"
  ON retail_preferred_couriers FOR SELECT
  TO authenticated
  USING (auth.uid() = retail_profile_id);

CREATE POLICY "Retail users can add preferred couriers"
  ON retail_preferred_couriers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = retail_profile_id);

CREATE POLICY "Retail users can remove preferred couriers"
  ON retail_preferred_couriers FOR DELETE
  TO authenticated
  USING (auth.uid() = retail_profile_id);

CREATE POLICY "Retail users can update preferred courier notes"
  ON retail_preferred_couriers FOR UPDATE
  TO authenticated
  USING (auth.uid() = retail_profile_id)
  WITH CHECK (auth.uid() = retail_profile_id);

-- RLS Policies for retail_defaults
CREATE POLICY "Users can view own retail defaults"
  ON retail_defaults FOR SELECT
  TO authenticated
  USING (auth.uid() = profile_id);

CREATE POLICY "Users can insert own retail defaults"
  ON retail_defaults FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = profile_id);

CREATE POLICY "Users can update own retail defaults"
  ON retail_defaults FOR UPDATE
  TO authenticated
  USING (auth.uid() = profile_id)
  WITH CHECK (auth.uid() = profile_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_retail_saved_locations_profile 
  ON retail_saved_locations(profile_id);

CREATE INDEX IF NOT EXISTS idx_retail_delivery_templates_profile 
  ON retail_delivery_templates(profile_id);

CREATE INDEX IF NOT EXISTS idx_retail_preferred_couriers_retail 
  ON retail_preferred_couriers(retail_profile_id);

CREATE INDEX IF NOT EXISTS idx_retail_preferred_couriers_courier 
  ON retail_preferred_couriers(courier_profile_id);
