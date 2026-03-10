/*
  # Create Saved Locations Table for Address Book

  ## Overview
  This migration creates a new table to store user's saved addresses for quick access
  during job creation. This enables users to save frequently used locations with
  nicknames for faster booking.

  ## Changes Made

  1. **New Table: saved_locations**
     - `id` (uuid, primary key) - Unique identifier
     - `user_id` (uuid, foreign key) - References profiles table
     - `nickname` (text) - User-friendly name (e.g., "Warehouse A", "Mom's House")
     - `full_address` (text) - Complete formatted address
     - `latitude` (double precision) - Location latitude coordinate
     - `longitude` (double precision) - Location longitude coordinate
     - `usage_count` (integer) - Number of times this location has been used
     - `created_at` (timestamptz) - Timestamp when location was saved
     - `updated_at` (timestamptz) - Timestamp of last update

  2. **Security (RLS)**
     - Enable RLS on saved_locations table
     - Users can only view their own saved locations
     - Users can only insert their own saved locations
     - Users can only update their own saved locations
     - Users can only delete their own saved locations

  3. **Performance**
     - Add index on user_id for fast lookup
     - Add index on user_id and usage_count for sorting by frequency

  ## Security Notes
  - All policies check auth.uid() to ensure users can only access their own data
  - No public access is allowed
  - Strict ownership validation on all operations
*/

-- Create saved_locations table
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

-- Enable RLS
ALTER TABLE saved_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
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

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_saved_locations_user_id 
  ON saved_locations(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_locations_user_usage 
  ON saved_locations(user_id, usage_count DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_saved_locations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trigger_update_saved_locations_updated_at
  BEFORE UPDATE ON saved_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_saved_locations_updated_at();