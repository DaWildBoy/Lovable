/*
  # Add Business Account Access to Cargo Items

  1. Changes
    - Add RLS policy for business accounts to view cargo items for available jobs
    - Allows haulage companies and retail businesses to see cargo details when browsing jobs
  
  2. Security
    - Business accounts can only view cargo items for jobs with status 'open' or 'bidding'
    - Cannot view cargo items for assigned/completed jobs unless they are the assigned company
    - Read-only access (no insert/update/delete permissions)
  
  3. Notes
    - This matches the access pattern that couriers have
    - Essential for haulage companies to assess job requirements before accepting
*/

-- Business accounts can view cargo items for available jobs
CREATE POLICY "Business accounts can view cargo items for available jobs"
  ON cargo_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN profiles ON profiles.id = auth.uid()
      WHERE jobs.id = cargo_items.job_id
      AND profiles.role = 'business'
      AND jobs.status IN ('open', 'bidding')
    )
  );

-- Business accounts can view cargo items for jobs assigned to them
CREATE POLICY "Business accounts can view cargo items for assigned jobs"
  ON cargo_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN profiles ON profiles.id = auth.uid()
      WHERE jobs.id = cargo_items.job_id
      AND profiles.role = 'business'
      AND jobs.assigned_company_id = auth.uid()
    )
  );