/*
  # Create Saved Locations Table

  ## Overview
  Creates the saved_locations table that was missing from the database.
  This table stores user's frequently used addresses for quick access
  during job creation and is prompted after job completion.

  1. New Table: saved_locations
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to profiles)
    - `nickname` (text) - User-friendly name
    - `full_address` (text) - Complete formatted address
    - `latitude` (double precision)
    - `longitude` (double precision)
    - `usage_count` (integer, default 0)
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on saved_locations
    - Users can only CRUD their own saved locations

  3. Performance
    - Index on user_id
    - Index on user_id + usage_count
*/

CREATE TABLE IF NOT EXISTS saved_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nickname text NOT NULL,
  full_address text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  usage_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved locations"
  ON saved_locations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own saved locations"
  ON saved_locations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own saved locations"
  ON saved_locations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own saved locations"
  ON saved_locations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user_id
  ON saved_locations(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user_usage
  ON saved_locations(user_id, usage_count DESC);

CREATE OR REPLACE FUNCTION update_saved_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_saved_locations_updated_at'
  ) THEN
    CREATE TRIGGER trigger_update_saved_locations_updated_at
      BEFORE UPDATE ON saved_locations
      FOR EACH ROW
      EXECUTE FUNCTION update_saved_locations_updated_at();
  END IF;
END $$;
