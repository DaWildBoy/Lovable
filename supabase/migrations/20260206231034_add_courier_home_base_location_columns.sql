/*
  # Add Courier Home Base Location

  1. New Columns on `profiles`
    - `home_base_location_text` (text) - Human-readable address of the courier's home base
    - `home_base_lat` (double precision) - Latitude of the home base
    - `home_base_lng` (double precision) - Longitude of the home base

  2. Purpose
    - Required by the backhaul matching system to find return trip opportunities
    - Without these columns, backhaul notifications cannot be generated after delivery completion
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'home_base_location_text'
  ) THEN
    ALTER TABLE profiles ADD COLUMN home_base_location_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'home_base_lat'
  ) THEN
    ALTER TABLE profiles ADD COLUMN home_base_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'home_base_lng'
  ) THEN
    ALTER TABLE profiles ADD COLUMN home_base_lng double precision;
  END IF;
END $$;
