/*
  # Add Haulage Company Job View Policy

  1. Security
    - Add SELECT policy for haulage companies to view jobs assigned to them
    - Allows haulage companies to view jobs where `assigned_company_id = auth.uid()`

  2. Changes
    - Create policy "Haulage companies can view assigned jobs"
    - This enables haulage companies to see active jobs in their dashboard after accepting them
*/

-- Add policy for haulage companies to view jobs assigned to them
CREATE POLICY "Haulage companies can view assigned jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    assigned_company_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'business'
      AND profiles.business_type = 'haulage'
    )
  );
