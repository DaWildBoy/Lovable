/*
  # Add Individual Dropoff Locations for Cargo Items
  
  ## Overview
  Allows retail businesses to specify unique delivery locations for each cargo item.
  This enables multi-stop deliveries where different items go to different addresses.
  
  ## Changes to cargo_items table
  1. New Location Fields:
    - `dropoff_location_text` (text) - Human-readable dropoff address for this item
    - `dropoff_lat` (numeric) - Latitude of dropoff location
    - `dropoff_lng` (numeric) - Longitude of dropoff location
    - `dropoff_contact_name` (text) - Name of recipient at this location
    - `dropoff_contact_phone` (text) - Phone number of recipient at this location
  
  ## Important Notes
  - These fields are nullable (optional) for backwards compatibility
  - When NULL, the item uses the job-level dropoff location
  - Retail businesses can specify different dropoff for each cargo item
  - Haulage companies typically deliver all items to one location (job-level dropoff)
*/

-- Add dropoff location fields to cargo_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dropoff_location_text'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dropoff_location_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dropoff_lat'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dropoff_lat numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dropoff_lng'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dropoff_lng numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dropoff_contact_name'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dropoff_contact_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dropoff_contact_phone'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dropoff_contact_phone text;
  END IF;
END $$;