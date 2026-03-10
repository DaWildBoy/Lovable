/*
  # Add cargo category and photo fields to jobs table

  1. Changes
    - Add `cargo_category` column to jobs table
      - Options: furniture, electronics, vehicles, equipment, pallets, boxes, other
    - Add `cargo_category_custom` column for custom category when "other" is selected
    - Add `cargo_photo_url` column for uploaded cargo photo URL
*/

-- Add new columns to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cargo_category'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cargo_category text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cargo_category_custom'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cargo_category_custom text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cargo_photo_url'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cargo_photo_url text;
  END IF;
END $$;