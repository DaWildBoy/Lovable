/*
  # Add RLS policies for haulage company job access

  1. Security Changes
    - Add SELECT policy: haulage companies can view open/bidding jobs they might accept
    - Add SELECT policy: haulage companies can view jobs assigned to them
    - Add UPDATE policy: haulage companies can update jobs assigned to them

  2. Important Notes
    - Haulage companies are identified by role='business' AND business_type='haulage'
    - They must be approved (business_verification_status='approved') to see available jobs
    - They can view and update only jobs assigned to their company via assigned_company_id
*/

CREATE POLICY "Haulage companies can view available jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    status IN ('open', 'bidding')
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'business'
        AND profiles.business_type = 'haulage'
        AND profiles.business_verification_status = 'approved'
    )
  );

CREATE POLICY "Haulage companies can view their assigned jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    assigned_company_id = auth.uid()
  );

CREATE POLICY "Haulage companies can update their assigned jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    assigned_company_id = auth.uid()
  )
  WITH CHECK (
    assigned_company_id = auth.uid()
  );
