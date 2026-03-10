/*
  # Add Per-Dimension Unit Columns to Cargo Items

  1. Modified Tables
    - `cargo_items`
      - `dimensions_length_unit` (text, default 'ft') - Unit for length measurement (cm, in, ft)
      - `dimensions_width_unit` (text, default 'in') - Unit for width measurement (cm, in, ft)
      - `dimensions_height_unit` (text, default 'in') - Unit for height measurement (cm, in, ft)

  2. Important Notes
    - Each dimension can now have its own unit (e.g. length in feet, width in inches)
    - The existing `dimensions_unit` column is preserved for backward compatibility
    - New columns default to common real-world usage: length in ft, width/height in in
    - Supports three unit types: cm (centimeters), in (inches), ft (feet)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dimensions_length_unit'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dimensions_length_unit text NOT NULL DEFAULT 'ft';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dimensions_width_unit'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dimensions_width_unit text NOT NULL DEFAULT 'in';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'dimensions_height_unit'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN dimensions_height_unit text NOT NULL DEFAULT 'in';
  END IF;
END $$;
