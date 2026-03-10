/*
  # Add marketplace inspection photo required flag

  1. Modified Tables
    - `jobs`
      - `marketplace_require_inspection_photo` (boolean, default false) - When true, the driver MUST upload a photo during inspection before submitting. When false, photo is optional.

  2. Important Notes
    - This column is set by the job creator (buyer) during job creation
    - It controls whether the driver's inspection photo is mandatory or optional
    - Existing jobs default to false (photo was always required before, but now we make it configurable)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'marketplace_require_inspection_photo'
  ) THEN
    ALTER TABLE jobs ADD COLUMN marketplace_require_inspection_photo boolean DEFAULT false;
  END IF;
END $$;
