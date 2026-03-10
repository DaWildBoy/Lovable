/*
  # Add Missing Cargo Dimensions Columns

  1. Changes
    - Add `dimensions_length` (numeric, nullable) to cargo_items
    - Add `dimensions_width` (numeric, nullable) to cargo_items
    - Add `dimensions_height` (numeric, nullable) to cargo_items
    - Add `dimensions_unit` (text, default 'cm') to cargo_items

  2. Notes
    - These columns are referenced by the application code but missing from the table
    - All fields are nullable to maintain backward compatibility
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dimensions_length'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dimensions_length numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dimensions_width'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dimensions_width numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dimensions_height'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dimensions_height numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dimensions_unit'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dimensions_unit text DEFAULT 'cm';
  END IF;
END $$;