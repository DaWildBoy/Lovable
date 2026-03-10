/*
  # Add Cargo Dimensions Fields

  1. Changes
    - Add `dimensions_length` (numeric, nullable) to cargo_items - Length in specified unit
    - Add `dimensions_width` (numeric, nullable) to cargo_items - Width in specified unit
    - Add `dimensions_height` (numeric, nullable) to cargo_items - Height in specified unit
    - Add `dimensions_unit` (text, default 'cm') to cargo_items - Unit of measurement (cm or in)
  
  2. Notes
    - Dimensions are optional and primarily useful for large cargo items
    - All fields are nullable to maintain backward compatibility
    - No data loss - existing cargo items remain unchanged
    - Dimensions help drivers/companies assess vehicle requirements
*/

-- Add dimension fields to cargo_items table
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