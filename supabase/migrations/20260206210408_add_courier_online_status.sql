/*
  # Add Courier Online Status

  1. Changes
    - Add `is_online` boolean column to `couriers` table
    - Default is `false` (offline)
    - Used by couriers to indicate availability for new jobs

  2. Purpose
    - Allow couriers to toggle their availability status
    - Help customers and the platform identify active couriers
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'is_online'
  ) THEN
    ALTER TABLE couriers ADD COLUMN is_online boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'last_online_at'
  ) THEN
    ALTER TABLE couriers ADD COLUMN last_online_at timestamptz;
  END IF;
END $$;