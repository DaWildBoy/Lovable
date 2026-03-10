/*
  # Add RLS policies for haulage companies on delivery_stops, pod_stops, and cargo_items

  1. Security Changes
    - delivery_stops: SELECT and UPDATE for haulage companies on their assigned jobs
    - pod_stops: SELECT, INSERT, and UPDATE for haulage companies on their assigned jobs
    - cargo_items: SELECT and UPDATE for haulage companies on their assigned jobs (available + assigned)

  2. Important Notes
    - Haulage companies are matched via jobs.assigned_company_id = auth.uid()
    - These policies allow the multi-stop wizard to load delivery stops and POD data
    - Without these, multi-stop jobs appear as single-stop because delivery_stops data is empty
    - cargo_items SELECT also covers open/bidding jobs so haulage can browse available jobs with cargo details
*/

-- delivery_stops: Haulage companies can read stops for their assigned jobs
CREATE POLICY "Haulage companies can read stops for assigned jobs"
  ON delivery_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
        AND jobs.assigned_company_id = auth.uid()
    )
  );

-- delivery_stops: Haulage companies can update stops for their assigned jobs
CREATE POLICY "Haulage companies can update stops for assigned jobs"
  ON delivery_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
        AND jobs.assigned_company_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = delivery_stops.job_id
        AND jobs.assigned_company_id = auth.uid()
    )
  );

-- pod_stops: Haulage companies can read POD stops for their assigned jobs
CREATE POLICY "Haulage companies can read POD stops for assigned jobs"
  ON pod_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
        AND jobs.assigned_company_id = auth.uid()
    )
  );

-- pod_stops: Haulage companies can insert POD stops for their assigned jobs
CREATE POLICY "Haulage companies can insert POD stops for assigned jobs"
  ON pod_stops FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
        AND jobs.assigned_company_id = auth.uid()
    )
  );

-- pod_stops: Haulage companies can update POD stops for their assigned jobs
CREATE POLICY "Haulage companies can update POD stops for assigned jobs"
  ON pod_stops FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
        AND jobs.assigned_company_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = pod_stops.job_id
        AND jobs.assigned_company_id = auth.uid()
    )
  );

-- cargo_items: Haulage companies can view cargo items for available and assigned jobs
CREATE POLICY "Haulage companies can view cargo items"
  ON cargo_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cargo_items.job_id
        AND (
          jobs.assigned_company_id = auth.uid()
          OR (
            jobs.status IN ('open', 'bidding')
            AND EXISTS (
              SELECT 1 FROM profiles
              WHERE profiles.id = auth.uid()
                AND profiles.role = 'business'
                AND profiles.business_type = 'haulage'
                AND profiles.business_verification_status = 'approved'
            )
          )
        )
    )
  );

-- cargo_items: Haulage companies can update cargo items for their assigned jobs
CREATE POLICY "Haulage companies can update cargo items"
  ON cargo_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cargo_items.job_id
        AND jobs.assigned_company_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = cargo_items.job_id
        AND jobs.assigned_company_id = auth.uid()
    )
  );
