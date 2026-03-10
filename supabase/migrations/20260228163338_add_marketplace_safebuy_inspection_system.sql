/*
  # Add Marketplace Safe-Buy Inspection System

  1. New Columns on `jobs` table
    - `marketplace_item_screenshot_url` (text) - Uploaded screenshot/photo of the item listing
    - `marketplace_inspection_instructions` (text) - Buyer's inspection instructions for the driver
    - `marketplace_payment_status` (text) - How seller is being paid: 'already_paid' or 'pay_after_inspection'
    - `marketplace_inspection_photo_url` (text) - Live photo taken by driver during inspection
    - `marketplace_inspection_status` (text) - Flow status: 'pending_inspection', 'inspection_submitted', 'buyer_approved', 'buyer_rejected'
    - `marketplace_buyer_approved_at` (timestamptz) - When buyer approved the inspection

  2. Notes
    - Extends the existing marketplace_safebuy job type
    - Driver must photograph item at pickup before collection
    - Buyer must approve photo before driver leaves with item
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_item_screenshot_url'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_item_screenshot_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_inspection_instructions'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_inspection_instructions text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_payment_status'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_payment_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_inspection_photo_url'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_inspection_photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_inspection_status'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_inspection_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_buyer_approved_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_buyer_approved_at timestamptz;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_marketplace_inspection_status
  ON jobs(marketplace_inspection_status)
  WHERE marketplace_inspection_status IS NOT NULL;