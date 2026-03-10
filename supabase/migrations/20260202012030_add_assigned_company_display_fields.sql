/*
  # Add Assigned Company Display Fields to Jobs

  ## Changes
  
  1. New Columns in `jobs` table
    - `assigned_company_name` (text, nullable) - Snapshot of haulage company name at assignment time
    - `assigned_company_logo_url` (text, nullable) - Snapshot of company logo URL at assignment time
  
  ## Purpose
  
  These fields store snapshots of the haulage company information when a job is accepted.
  This ensures customers/retail users can see the assigned company details even if the
  company later changes their name or logo.
  
  ## Notes
  
  - Fields are nullable as not all jobs will have an assigned company
  - These are display-only snapshots and do not affect job routing or functionality
  - Logo URL can be null if company has no logo set
*/

-- Add assigned company display fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_company_name'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_company_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'assigned_company_logo_url'
  ) THEN
    ALTER TABLE jobs ADD COLUMN assigned_company_logo_url text;
  END IF;
END $$;
