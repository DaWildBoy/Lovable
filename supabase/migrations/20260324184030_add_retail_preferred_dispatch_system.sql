/*
  # Add Retail Preferred Dispatch System

  1. Modified Tables
    - `jobs`
      - `job_visibility` (text, default 'public') - Controls who can see the job: 'public' or 'preferred_preview'
      - `preferred_dispatch_expires_at` (timestamptz) - When the preferred preview period ends and job goes public
      - `send_to_preferred_first` (boolean, default false) - Whether the retail customer opted to send to preferred drivers first

  2. Important Notes
    - Only retail business jobs use the preferred dispatch system
    - Normal and haulage jobs always have job_visibility = 'public' and no timer
    - The preferred preview window is 5 minutes, after which the job auto-transitions to public
    - When any driver accepts a job, the timer is irrelevant (acceptance clears queued state)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'job_visibility'
  ) THEN
    ALTER TABLE jobs ADD COLUMN job_visibility text NOT NULL DEFAULT 'public';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'preferred_dispatch_expires_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN preferred_dispatch_expires_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'send_to_preferred_first'
  ) THEN
    ALTER TABLE jobs ADD COLUMN send_to_preferred_first boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_jobs_visibility ON jobs(job_visibility);
CREATE INDEX IF NOT EXISTS idx_jobs_preferred_expires ON jobs(preferred_dispatch_expires_at) WHERE preferred_dispatch_expires_at IS NOT NULL;
