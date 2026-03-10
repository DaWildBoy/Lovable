/*
  # Add Business Verification Fields to Profiles

  1. New Columns
    - `company_name` (text) - Name of the business/company
    - `company_email` (text) - Official company email address
    - `company_address` (text) - Physical business address
    - `business_verification_status` (text) - Status of business verification (pending/approved/rejected)
    - `business_verified` (boolean) - Quick check if business is verified
    - `business_verified_at` (timestamptz) - When business was verified
    - `business_verified_by` (uuid) - Admin who verified the business
  
  2. Purpose
    - Allow business users to provide company information during profile completion
    - Track verification status of business accounts
    - Require admin approval before businesses can fully use the platform
  
  3. Security
    - Only business role users should have these fields populated
    - Verification can only be done by admins
    - Default status is "pending" for new business profiles
*/

-- Add business-specific fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'company_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN company_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'company_email'
  ) THEN
    ALTER TABLE profiles ADD COLUMN company_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'company_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN company_address text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_verification_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_verification_status text CHECK (business_verification_status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_verified_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_verified_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_verified_by uuid REFERENCES profiles(id);
  END IF;
END $$;
