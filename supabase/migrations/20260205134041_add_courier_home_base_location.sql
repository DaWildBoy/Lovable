/*
  # Add Courier Home Base Location

  1. Changes
    - Add home base location fields to profiles table for couriers
    - Fields include: home_base_location_text, home_base_lat, home_base_lng
    - These fields are optional and used for backhaul matching

  2. Purpose
    - Enable the backhaul matching system to find return trip opportunities
    - Help drivers find jobs that match their route home
*/

-- Add home base location fields for couriers
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
