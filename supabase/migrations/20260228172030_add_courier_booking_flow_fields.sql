/*
  # Add Courier Booking Flow Fields

  1. New Columns on `jobs`
    - `courier_cargo_size` (text) - Envelope / Small Parcel / Medium Box
    - `courier_urgency` (text) - 'standard' (4hr) or 'express' (rush, 1.5x)
    - `courier_recipient_name` (text) - Mandatory handover recipient name
    - `courier_recipient_phone` (text) - Mandatory handover recipient phone
    - `courier_building_details` (text) - Building/floor/unit instructions
    - `courier_require_signature` (boolean) - Whether signature is required on handover
    - `courier_safety_acknowledged` (boolean) - Customer acknowledged safety/liability terms
    - `courier_express_multiplier` (numeric) - Multiplier applied for express rush (e.g. 1.5)

  2. Notes
    - All fields are nullable so they don't affect existing standard/marketplace/junk jobs
    - Only populated when job_type = 'courier'
    - The courier_cargo_size drives fleet filtering: Envelope/Small = moto/sedan, Medium = sedan only
    - The courier_urgency + courier_express_multiplier controls dynamic pricing at 1.5x for express
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_cargo_size'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_cargo_size text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_urgency'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_urgency text DEFAULT 'standard';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_recipient_name'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_recipient_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_recipient_phone'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_recipient_phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_building_details'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_building_details text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_require_signature'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_require_signature boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_safety_acknowledged'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_safety_acknowledged boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_express_multiplier'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_express_multiplier numeric DEFAULT 1.0;
  END IF;
END $$;
