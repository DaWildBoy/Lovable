/*
  # Add Job Type Column to Jobs Table

  1. Modified Tables
    - `jobs`
      - `job_type` (text, default 'standard') - Categorizes the type of delivery job:
        - 'standard' - Regular delivery/moving job (default for existing jobs)
        - 'courier' - Quick moto/sedan runs for small items ($30-$50 TTD range)
        - 'marketplace_safebuy' - Proxy pickup from marketplace sellers with inspect & collect
        - 'junk_removal' - Disposal mode with auto-locked dump destinations
        - 'errand_runner' - Personal assistant errands (pharmacy, store pickups, etc.)
      - `marketplace_seller_contact` (text, nullable) - Seller contact info for marketplace jobs
      - `marketplace_listing_url` (text, nullable) - Link to the marketplace listing
      - `marketplace_max_budget` (numeric, nullable) - Max budget the customer is willing to pay for the item
      - `errand_store_name` (text, nullable) - Name of store for errand runs
      - `errand_item_list` (text, nullable) - List of items to pick up for errand runs
      - `errand_estimated_item_cost` (numeric, nullable) - Estimated cost of items for errand runs
      - `junk_disposal_type` (text, nullable) - Type of junk for disposal jobs
      - `junk_tipping_fee_included` (boolean, default false) - Whether tipping fee is included

  2. Important Notes
    - Existing jobs default to 'standard' type
    - New columns are nullable to maintain backward compatibility
    - No destructive changes to existing data
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'job_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN job_type text NOT NULL DEFAULT 'standard';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_seller_contact'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_seller_contact text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_listing_url'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_listing_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_max_budget'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_max_budget numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'errand_store_name'
  ) THEN
    ALTER TABLE jobs ADD COLUMN errand_store_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'errand_item_list'
  ) THEN
    ALTER TABLE jobs ADD COLUMN errand_item_list text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'errand_estimated_item_cost'
  ) THEN
    ALTER TABLE jobs ADD COLUMN errand_estimated_item_cost numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_disposal_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_disposal_type text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_tipping_fee_included'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_tipping_fee_included boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_job_type ON jobs(job_type);