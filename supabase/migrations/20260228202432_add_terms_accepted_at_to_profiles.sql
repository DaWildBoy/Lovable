/*
  # Add Terms of Service acceptance tracking to profiles

  1. Modified Tables
    - `profiles`
      - `terms_accepted_at` (timestamptz, nullable) - When the user accepted the Terms of Service
      - `terms_version` (text, nullable) - Which version of the Terms they accepted

  2. Notes
    - Only customer accounts are required to accept terms at signup
    - Existing users will have NULL values until they re-accept
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'terms_accepted_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN terms_accepted_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'terms_version'
  ) THEN
    ALTER TABLE profiles ADD COLUMN terms_version text;
  END IF;
END $$;
