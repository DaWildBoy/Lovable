/*
  # Add RLS policy for haulage to read delivery_stops on available jobs

  1. Security Changes
    - delivery_stops: SELECT for haulage companies on open/bidding jobs
    - This allows haulage companies to see multi-stop details when browsing available jobs

  2. Important Notes
    - Only approved haulage companies can view stops for available jobs
*/

CREATE POLICY "Haulage companies can read stops for available jobs"
  ON delivery_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
        AND jobs.status IN ('open', 'bidding')
        AND EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
            AND profiles.role = 'business'
            AND profiles.business_type = 'haulage'
            AND profiles.business_verification_status = 'approved'
        )
    )
  );
