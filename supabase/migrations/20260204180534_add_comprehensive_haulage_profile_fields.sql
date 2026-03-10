/*
  # Add Comprehensive Haulage Profile Fields

  1. New Profile Fields for Haulage Companies
    
    ## Insurance & Compliance
    - `haulage_insurance_certificate_url` (text) - URL to insurance certificate document
    - `haulage_cargo_insurance_amount` (numeric) - Coverage amount in TTD
    - `haulage_operating_license_number` (text) - Government operating license ID
    - `haulage_operating_license_expiry` (date) - License expiration date
    - `haulage_dot_number` (text) - Department of Transportation or equivalent ID
    - `haulage_safety_rating` (text) - Safety certification level
    
    ## Operational Capabilities
    - `haulage_service_hours` (text) - Operating hours or "24/7"
    - `haulage_max_fleet_capacity_kg` (integer) - Maximum weight capacity across all vehicles
    - `haulage_equipment_types` (text[]) - Array of equipment types (e.g., flatbed, box truck)
    
    ## Business & Financial
    - `haulage_payment_terms` (text) - Payment terms (NET 30, NET 60, Immediate)
    - `haulage_tax_id` (text) - Business tax identification number
    - `haulage_billing_email` (text) - Separate billing contact email
    - `haulage_billing_phone` (text) - Billing contact phone
    
    ## Communication
    - `haulage_emergency_contact` (text) - 24/7 emergency contact number
    - `haulage_dispatch_phone` (text) - Dispatch/operations phone
    - `haulage_preferred_contact_method` (text) - SMS, Email, App, Phone
    
    ## Marketing & Visibility
    - `haulage_service_highlights` (text) - Brief description of unique services/strengths
    
    ## Performance Tracking (auto-calculated)
    - `haulage_on_time_delivery_rate` (numeric) - Percentage of on-time deliveries
    - `haulage_incident_rate` (numeric) - Claims/damage incidents per 100 deliveries

  2. Security
    - All fields allow updates by the profile owner
*/

-- Add insurance & compliance fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_insurance_certificate_url text,
ADD COLUMN IF NOT EXISTS haulage_cargo_insurance_amount numeric(12,2),
ADD COLUMN IF NOT EXISTS haulage_operating_license_number text,
ADD COLUMN IF NOT EXISTS haulage_operating_license_expiry date,
ADD COLUMN IF NOT EXISTS haulage_dot_number text,
ADD COLUMN IF NOT EXISTS haulage_safety_rating text;

-- Add operational capability fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_service_hours text DEFAULT 'Business Hours',
ADD COLUMN IF NOT EXISTS haulage_max_fleet_capacity_kg integer,
ADD COLUMN IF NOT EXISTS haulage_equipment_types text[];

-- Add business & financial fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_payment_terms text DEFAULT 'Immediate',
ADD COLUMN IF NOT EXISTS haulage_tax_id text,
ADD COLUMN IF NOT EXISTS haulage_billing_email text,
ADD COLUMN IF NOT EXISTS haulage_billing_phone text;

-- Add communication fields
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_emergency_contact text,
ADD COLUMN IF NOT EXISTS haulage_dispatch_phone text,
ADD COLUMN IF NOT EXISTS haulage_preferred_contact_method text DEFAULT 'App';

-- Add marketing field
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_service_highlights text;

-- Add performance tracking fields (will be auto-calculated by the system)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS haulage_on_time_delivery_rate numeric(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS haulage_incident_rate numeric(5,2) DEFAULT 0;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_haulage_business_type ON profiles(business_type) WHERE business_type = 'haulage';
