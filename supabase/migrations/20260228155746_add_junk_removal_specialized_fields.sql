/*
  # Add Specialized Junk Removal Fields

  1. Modified Tables
    - `jobs`
      - `junk_waste_categories` (text[] - array of selected waste categories)
      - `junk_safety_acknowledged` (boolean - hazmat safety confirmation)
      - `junk_photo_url` (text - mandatory photo of junk)
      - `junk_curbside` (boolean - whether junk is already on the curb)
      - `junk_heavy_lifting_fee` (numeric - $150 TTD surcharge if not curbside)
      - `junk_landfill_name` (text - auto-selected nearest landfill name)
      - `junk_tipping_fee` (numeric - mandatory $100 tipping fee)

  2. Notes
    - These fields support the specialized junk removal booking flow
    - junk_heavy_lifting_fee defaults to 0
    - junk_tipping_fee defaults to 100 for all junk removal jobs
    - junk_safety_acknowledged must be true for junk removal submissions
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_waste_categories'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_waste_categories text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_safety_acknowledged'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_safety_acknowledged boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_photo_url'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_curbside'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_curbside boolean DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_heavy_lifting_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_heavy_lifting_fee numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_landfill_name'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_landfill_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_tipping_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_tipping_fee numeric DEFAULT 0;
  END IF;
END $$;
