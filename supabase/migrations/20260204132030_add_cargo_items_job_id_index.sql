/*
  # Add Index on cargo_items.job_id for Better Query Performance

  1. Changes
    - Add index on cargo_items(job_id) to improve join performance
    - This will significantly speed up queries that fetch cargo items for jobs

  2. Performance
    - Improves performance of jobs queries that include cargo_items
    - Reduces query time when filtering or joining on job_id
*/

-- Add index on cargo_items.job_id
CREATE INDEX IF NOT EXISTS idx_cargo_items_job_id ON cargo_items(job_id);
