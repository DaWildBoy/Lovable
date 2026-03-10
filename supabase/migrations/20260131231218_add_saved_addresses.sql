/*
  # Add Saved Addresses Feature

  1. New Tables
    - `saved_addresses`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `label` (text) - e.g. "Home", "Office", "Warehouse"
      - `address_text` (text) - full address string
      - `lat` (numeric, nullable) - latitude for geocoding
      - `lng` (numeric, nullable) - longitude for geocoding
      - `notes` (text, nullable) - optional notes
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `saved_addresses` table
    - Add policies for users to manage their own saved addresses

  3. Important Notes
    - This is an OPTIONAL feature that does NOT replace the Create Job flow
    - Saved addresses are shortcuts that can be copied into job forms
    - Jobs continue to store their own address values independently
*/

CREATE TABLE IF NOT EXISTS saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  address_text text NOT NULL,
  lat numeric,
  lng numeric,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved addresses"
  ON saved_addresses
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own saved addresses"
  ON saved_addresses
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own saved addresses"
  ON saved_addresses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own saved addresses"
  ON saved_addresses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_addresses_user_id ON saved_addresses(user_id);