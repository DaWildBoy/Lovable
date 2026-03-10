/*
  # Add Special Requirements to Jobs

  ## Overview
  Adds special requirement flags to jobs to help truckers understand cargo needs
  and prepare accordingly. This helps match the right courier with the right job.

  ## New Columns Added

  ### Jobs Table - Special Requirements
    - `is_fragile` (boolean) - Indicates cargo is fragile and needs extra care
    - `needs_cover` (boolean) - Cargo needs to be covered/protected from elements
    - `requires_heavy_lift` (boolean) - Heavy cargo requiring lorry man assistance
    - `has_security_gate` (boolean) - Delivery location has security gate access
    - `special_requirements_notes` (text) - Additional special requirement details

  ## Usage
    - Customers specify requirements during job creation
    - Truckers can see requirements before bidding
    - Helps match appropriate vehicles/equipment to jobs
    - Ensures proper preparation for pickup/delivery

  ## Security
    - All fields are optional (default false for booleans)
    - Only job creator can set these during creation
    - Visible to all bidding truckers
*/

-- Add special requirements columns to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'is_fragile'
  ) THEN
    ALTER TABLE jobs ADD COLUMN is_fragile boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'needs_cover'
  ) THEN
    ALTER TABLE jobs ADD COLUMN needs_cover boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'requires_heavy_lift'
  ) THEN
    ALTER TABLE jobs ADD COLUMN requires_heavy_lift boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'has_security_gate'
  ) THEN
    ALTER TABLE jobs ADD COLUMN has_security_gate boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'special_requirements_notes'
  ) THEN
    ALTER TABLE jobs ADD COLUMN special_requirements_notes text;
  END IF;
END $$;

-- Create index for filtering jobs by special requirements
CREATE INDEX IF NOT EXISTS idx_jobs_special_requirements 
ON jobs(is_fragile, needs_cover, requires_heavy_lift, has_security_gate);