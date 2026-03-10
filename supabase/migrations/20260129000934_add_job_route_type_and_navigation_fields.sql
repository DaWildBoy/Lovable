/*
  # Add Job Route Type and Navigation Fields

  1. Changes
    - Add `route_type` column to jobs table ('FIXED' | 'FLEXIBLE')
      - FIXED: Drop-off order must be followed sequentially
      - FLEXIBLE: Driver can choose which stop to deliver next
    - Add `current_selected_stop_id` to jobs table
      - Used in FLEXIBLE mode to track which stop driver has selected next
    - Set default route_type to 'FIXED' for existing jobs
    
  2. Purpose
    - Enable "Job Directions" navigation feature for courier/trucking active jobs
    - Support both fixed-sequence and flexible delivery ordering
*/

-- Add route_type column to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'route_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN route_type text DEFAULT 'FIXED' CHECK (route_type IN ('FIXED', 'FLEXIBLE'));
  END IF;
END $$;

-- Add current_selected_stop_id column for flexible routing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'current_selected_stop_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN current_selected_stop_id uuid REFERENCES delivery_stops(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add index for faster lookup
CREATE INDEX IF NOT EXISTS idx_jobs_current_selected_stop ON jobs(current_selected_stop_id);

-- Update existing jobs to have FIXED route type (default)
UPDATE jobs SET route_type = 'FIXED' WHERE route_type IS NULL;