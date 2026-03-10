/*
  # Add Cash to Return System

  1. Modified Tables
    - `jobs`
      - `cash_to_return` (boolean, default false) - whether recipient must pay cash for cargo
      - `cash_to_return_amount` (numeric) - expected cash amount to collect from recipient
      - `cash_collection_status` (text, default 'none') - tracks cash lifecycle: none, pending, collected, returned

  2. New Tables
    - `cash_collections`
      - `id` (uuid, primary key)
      - `job_id` (uuid, FK to jobs)
      - `expected_amount` (numeric) - amount the job creator expects
      - `actual_amount` (numeric) - amount the driver actually collected
      - `variance` (numeric) - difference between expected and actual (auto-calculated)
      - `variance_reason` (text) - driver's explanation if amounts differ
      - `customer_signature_url` (text) - recipient's signature confirming the amount paid
      - `cash_photo_url` (text) - optional photo evidence of cash
      - `recipient_confirmed` (boolean) - whether recipient signed off on amount
      - `recipient_confirmed_at` (timestamptz)
      - `collected_by_user_id` (uuid, FK to auth.users) - the driver who collected
      - `collected_at` (timestamptz) - when cash was collected
      - `returned_at` (timestamptz) - when cash was returned to job creator
      - `return_confirmed_by_user_id` (uuid) - who confirmed the return
      - `return_signature_url` (text) - job creator's signature on cash receipt
      - `status` (text) - pending_collection, collected, in_transit, returned, disputed
      - `dispute_notes` (text)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on `cash_collections`
    - Couriers can create and update their own cash collection records
    - Job owners can view cash collection records for their jobs
    - Couriers assigned to job can view records

  4. Notes
    - Cash collection happens at dropoff: recipient pays driver for cargo
    - Driver must return cash to sender before job can be completed
    - Driver cannot accept new jobs while holding unreturned cash
    - Variance tracking provides dispute resolution evidence
*/

-- Add cash_to_return columns to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cash_to_return'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cash_to_return boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cash_to_return_amount'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cash_to_return_amount numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cash_collection_status'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cash_collection_status text DEFAULT 'none';
  END IF;
END $$;

-- Create cash_collections table
CREATE TABLE IF NOT EXISTS cash_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  expected_amount numeric NOT NULL DEFAULT 0,
  actual_amount numeric DEFAULT 0,
  variance numeric GENERATED ALWAYS AS (actual_amount - expected_amount) STORED,
  variance_reason text,
  customer_signature_url text,
  cash_photo_url text,
  recipient_confirmed boolean DEFAULT false,
  recipient_confirmed_at timestamptz,
  collected_by_user_id uuid REFERENCES auth.users(id),
  collected_at timestamptz,
  returned_at timestamptz,
  return_confirmed_by_user_id uuid REFERENCES auth.users(id),
  return_signature_url text,
  status text DEFAULT 'pending_collection',
  dispute_notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE cash_collections ENABLE ROW LEVEL SECURITY;

-- Couriers assigned to the job can view cash collection records
CREATE POLICY "Assigned couriers can view cash collections"
  ON cash_collections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cash_collections.job_id
      AND jobs.assigned_courier_id = auth.uid()
    )
  );

-- Job owners can view cash collection records
CREATE POLICY "Job owners can view cash collections"
  ON cash_collections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cash_collections.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Couriers can create cash collection records for jobs assigned to them
CREATE POLICY "Assigned couriers can create cash collections"
  ON cash_collections FOR INSERT
  TO authenticated
  WITH CHECK (
    collected_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cash_collections.job_id
      AND jobs.assigned_courier_id = auth.uid()
    )
  );

-- Couriers can update cash collection records they created
CREATE POLICY "Couriers can update own cash collections"
  ON cash_collections FOR UPDATE
  TO authenticated
  USING (collected_by_user_id = auth.uid())
  WITH CHECK (collected_by_user_id = auth.uid());

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_cash_collections_job_id ON cash_collections(job_id);
CREATE INDEX IF NOT EXISTS idx_cash_collections_status ON cash_collections(status);
CREATE INDEX IF NOT EXISTS idx_cash_collections_collected_by ON cash_collections(collected_by_user_id);
