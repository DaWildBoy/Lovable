/*
  # Add Courier Terms of Service acceptance tracking to profiles

  1. Modified Tables
    - `profiles`
      - `courier_terms_accepted_at` (timestamptz, nullable) - When the courier accepted the Driver Terms of Service
      - `courier_terms_version` (text, nullable) - Which version of the Courier Terms they accepted

  2. Notes
    - Separate from the general `terms_accepted_at` column used by customers, retail, and haulage
    - Couriers must accept courier-specific terms during onboarding
    - Existing couriers will have NULL values until they accept the terms
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_terms_accepted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_terms_accepted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_terms_version'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_terms_version text;
  END IF;
END $$;
