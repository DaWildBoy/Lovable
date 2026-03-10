/*
  # Backfill POD Records for Existing Jobs

  1. Purpose
    - Create proof_of_delivery records for all existing jobs that don't have them
    - Set status based on job completion status
    - Default to 'NONE' for required_type since old jobs didn't specify POD requirements

  2. Changes
    - Insert POD records for jobs without them
    - Set appropriate status (NOT_REQUIRED for old jobs)
    - Handle completed vs in-progress jobs

  3. Safety
    - Uses INSERT ... ON CONFLICT DO NOTHING to avoid duplicate errors
    - Does not modify existing POD records
*/

-- Insert POD records for all jobs that don't have one
INSERT INTO proof_of_delivery (job_id, required_type, status, created_at, updated_at)
SELECT 
  j.id,
  'NONE'::text as required_type,
  CASE 
    WHEN j.status = 'completed' THEN 'NOT_REQUIRED'::text
    ELSE 'NOT_REQUIRED'::text
  END as status,
  j.created_at,
  now()
FROM jobs j
WHERE NOT EXISTS (
  SELECT 1 FROM proof_of_delivery pod WHERE pod.job_id = j.id
)
ON CONFLICT (job_id) DO NOTHING;