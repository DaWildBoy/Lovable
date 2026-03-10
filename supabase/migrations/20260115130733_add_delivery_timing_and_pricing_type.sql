/*
  # Add delivery timing and pricing type fields to jobs table

  1. Changes
    - Add `delivery_type` column to jobs table
      - Options: asap, scheduled
      - Default: asap
    - Add `scheduled_pickup_time` column for scheduled pickup date/time
    - Add `scheduled_dropoff_time` column for scheduled dropoff date/time
    - Add `pricing_type` column to jobs table
      - Options: fixed, bid
      - Default: fixed
    - Add `is_open_to_bids` boolean column
      - Indicates if job accepts counter offers
      - Default: false for fixed pricing, true for bid style
    
  2. Notes
    - scheduled_pickup_time and scheduled_dropoff_time are nullable (only used for scheduled deliveries)
    - pricing_type determines if customer wants fixed price or open bidding
    - is_open_to_bids allows fixed price jobs to still accept counter offers if desired
*/

-- Add new columns to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'delivery_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN delivery_type text DEFAULT 'asap';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'scheduled_pickup_time'
  ) THEN
    ALTER TABLE jobs ADD COLUMN scheduled_pickup_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'scheduled_dropoff_time'
  ) THEN
    ALTER TABLE jobs ADD COLUMN scheduled_dropoff_time timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'pricing_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN pricing_type text DEFAULT 'fixed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'is_open_to_bids'
  ) THEN
    ALTER TABLE jobs ADD COLUMN is_open_to_bids boolean DEFAULT false;
  END IF;
END $$;