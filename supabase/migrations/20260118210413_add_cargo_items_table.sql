/*
  # Add Cargo Items Table for Multiple Cargo Support

  1. New Tables
    - `cargo_items`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references jobs)
      - `cargo_size_category` (text: small|medium|large)
      - `cargo_category` (text: furniture|electronics|vehicles|equipment|pallets|boxes|other)
      - `cargo_category_custom` (text, nullable)
      - `cargo_weight_kg` (numeric, nullable)
      - `cargo_photo_url` (text, nullable)
      - `cargo_notes` (text, nullable)
      - `created_at` (timestamptz)
  
  2. Changes
    - Jobs table no longer stores single cargo details (kept for backward compatibility)
    - Multiple cargo items per job now supported via cargo_items table
  
  3. Security
    - Enable RLS on cargo_items table
    - Customers can view/edit cargo items for their jobs
    - Couriers can view cargo items for jobs they're assigned to
*/

CREATE TABLE IF NOT EXISTS cargo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  cargo_size_category text NOT NULL CHECK (cargo_size_category IN ('small', 'medium', 'large')),
  cargo_category text NOT NULL CHECK (cargo_category IN ('furniture', 'electronics', 'vehicles', 'equipment', 'pallets', 'boxes', 'other')),
  cargo_category_custom text,
  cargo_weight_kg numeric,
  cargo_photo_url text,
  cargo_notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cargo_items ENABLE ROW LEVEL SECURITY;

-- Customers can view cargo items for their jobs
CREATE POLICY "Customers can view own job cargo items"
  ON cargo_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cargo_items.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Customers can insert cargo items for their jobs
CREATE POLICY "Customers can insert cargo items for own jobs"
  ON cargo_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cargo_items.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Customers can update cargo items for their jobs (before assignment)
CREATE POLICY "Customers can update cargo items for own jobs"
  ON cargo_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cargo_items.job_id
      AND jobs.customer_user_id = auth.uid()
      AND jobs.status IN ('draft', 'open', 'bidding')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cargo_items.job_id
      AND jobs.customer_user_id = auth.uid()
      AND jobs.status IN ('draft', 'open', 'bidding')
    )
  );

-- Customers can delete cargo items for their jobs (before assignment)
CREATE POLICY "Customers can delete cargo items for own jobs"
  ON cargo_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cargo_items.job_id
      AND jobs.customer_user_id = auth.uid()
      AND jobs.status IN ('draft', 'open', 'bidding')
    )
  );

-- Couriers can view cargo items for assigned or available jobs
CREATE POLICY "Couriers can view cargo items for available jobs"
  ON cargo_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN couriers ON couriers.user_id = auth.uid()
      WHERE jobs.id = cargo_items.job_id
      AND (
        jobs.status IN ('open', 'bidding')
        OR jobs.assigned_courier_id = couriers.id
      )
    )
  );