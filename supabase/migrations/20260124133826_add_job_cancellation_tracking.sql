/*
  # Add Job Cancellation Tracking Fields
  
  ## Overview
  Adds fields to track job cancellations and prepare for future cancellation fee system.
  These fields support retail businesses cancelling jobs with transparency about potential fees.
  
  ## Changes to jobs table
  1. Cancellation Tracking:
    - `cancelled_at` (timestamptz) - When the job was cancelled
    - `cancelled_by_user_id` (uuid) - Who cancelled the job
    - `cancelled_reason` (text) - Optional reason for cancellation
  
  2. Future Cancellation Fee System (placeholders):
    - `cancellation_fee_eligible` (boolean) - Whether this cancellation is eligible for a fee
    - `cancellation_fee_percent` (numeric) - Percentage of job price to charge as fee
    - `cancellation_fee_amount_ttd` (numeric) - Calculated fee amount in TTD
    - `cancellation_fee_applied` (boolean) - Whether the fee has been charged
  
  ## Important Notes
  - These fields are nullable for backwards compatibility
  - Fee fields are prepared for future implementation but not enforced yet
  - Cancellation tracking helps with analytics and dispute resolution
*/

-- Add cancellation tracking fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cancelled_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cancelled_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cancelled_by_user_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cancelled_by_user_id uuid REFERENCES auth.users(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cancelled_reason'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cancelled_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cancellation_fee_eligible'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cancellation_fee_eligible boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cancellation_fee_percent'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cancellation_fee_percent numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cancellation_fee_amount_ttd'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cancellation_fee_amount_ttd numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cancellation_fee_applied'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cancellation_fee_applied boolean DEFAULT false;
  END IF;
END $$;