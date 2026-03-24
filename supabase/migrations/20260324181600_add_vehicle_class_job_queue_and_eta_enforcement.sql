/*
  # Vehicle Class, Job Queue System, and ETA Enforcement

  1. Modified Tables
    - `couriers`
      - `vehicle_class` (text) - heavy_freight or courier_class, derived from vehicle_type
      - `can_accept_multiple_jobs` (boolean) - whether driver can hold multiple active jobs
    - `jobs`
      - New status 'queued_next' added to constraint for Uber-style sequencing
      - `expected_travel_time_minutes` (integer) - calculated ETA at job acceptance
      - `eta_calculated_at` (timestamptz) - when ETA was calculated
      - `actual_arrival_at` (timestamptz) - when driver actually arrived at pickup
      - `detour_flagged` (boolean) - true if unauthorized detour detected
      - `detour_flagged_at` (timestamptz) - when detour was flagged
      - `queue_position` (integer) - 1 for active, 2 for queued next

  2. New Tables
    - `eta_deviation_logs`
      - Tracks GPS deviation events for audit
      - Records detour distance, duration, and penalty applied

  3. Security
    - Enable RLS on `eta_deviation_logs`
    - Couriers can view their own deviation logs
    - System can insert records via authenticated context

  4. Important Notes
    - Heavy Freight (truck, fleet): max 1 active job
    - Courier Class (motorcycle, car, van): max 2 active jobs with directional radius
    - QUEUED_NEXT jobs hide GPS from customer, show status card instead
    - ETA deviation > 2km for > 5 min flags as unauthorized detour
    - Arrival > ETA + 15 min deducts 0.2 from driver rating
    - Rating < 4.5 disables multiple job acceptance
*/

-- 1. Add vehicle_class and can_accept_multiple_jobs to couriers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'vehicle_class'
  ) THEN
    ALTER TABLE couriers ADD COLUMN vehicle_class text DEFAULT 'courier_class';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'can_accept_multiple_jobs'
  ) THEN
    ALTER TABLE couriers ADD COLUMN can_accept_multiple_jobs boolean DEFAULT true;
  END IF;
END $$;

-- 2. Backfill vehicle_class from existing vehicle_type
UPDATE couriers
SET vehicle_class = CASE
  WHEN vehicle_type IN ('truck', 'fleet') THEN 'heavy_freight'
  ELSE 'courier_class'
END
WHERE vehicle_class IS NULL OR vehicle_class = 'courier_class';

-- Re-set heavy freight for truck/fleet
UPDATE couriers
SET vehicle_class = 'heavy_freight'
WHERE vehicle_type IN ('truck', 'fleet');

-- 3. Update jobs status constraint to include 'queued_next'
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'jobs' AND constraint_name = 'jobs_status_check'
  ) THEN
    ALTER TABLE jobs DROP CONSTRAINT jobs_status_check;
  END IF;

  ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
    CHECK (status = ANY (ARRAY[
      'draft'::text,
      'open'::text,
      'bidding'::text,
      'assigned'::text,
      'queued_next'::text,
      'on_way_to_pickup'::text,
      'arrived_waiting'::text,
      'loading_cargo'::text,
      'cargo_collected'::text,
      'in_transit'::text,
      'delivered'::text,
      'in_progress'::text,
      'returning'::text,
      'completed'::text,
      'cancelled'::text
    ]));
END $$;

-- 4. Add ETA and queue columns to jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'expected_travel_time_minutes'
  ) THEN
    ALTER TABLE jobs ADD COLUMN expected_travel_time_minutes integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'eta_calculated_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN eta_calculated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'actual_arrival_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN actual_arrival_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'detour_flagged'
  ) THEN
    ALTER TABLE jobs ADD COLUMN detour_flagged boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'detour_flagged_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN detour_flagged_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'queue_position'
  ) THEN
    ALTER TABLE jobs ADD COLUMN queue_position integer DEFAULT 1;
  END IF;
END $$;

-- 5. Create ETA deviation logs table
CREATE TABLE IF NOT EXISTS eta_deviation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id),
  courier_id uuid NOT NULL REFERENCES couriers(id),
  driver_user_id uuid NOT NULL REFERENCES profiles(id),
  deviation_type text NOT NULL DEFAULT 'detour',
  deviation_distance_meters numeric DEFAULT 0,
  deviation_duration_seconds integer DEFAULT 0,
  expected_eta_minutes integer,
  actual_arrival_minutes integer,
  penalty_applied boolean DEFAULT false,
  rating_deducted numeric DEFAULT 0,
  driver_lat numeric,
  driver_lng numeric,
  route_lat numeric,
  route_lng numeric,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE eta_deviation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Couriers can view own deviation logs"
  ON eta_deviation_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = driver_user_id);

CREATE POLICY "Authenticated users can insert deviation logs"
  ON eta_deviation_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = driver_user_id);

-- 6. Notification trigger for queued_next status
CREATE OR REPLACE FUNCTION notify_queued_next_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'queued_next' AND (OLD.status IS NULL OR OLD.status != 'queued_next') THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.customer_user_id,
      'job_queued',
      'Driver Completing Nearby Drop-off',
      'Your driver is completing a nearby delivery and will head to you shortly.',
      jsonb_build_object('job_id', NEW.id)
    );
  END IF;

  IF NEW.status = 'assigned' AND OLD.status = 'queued_next' THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.customer_user_id,
      'driver_heading_to_you',
      'Your Driver is Now Heading to You',
      'Your driver has completed a nearby drop-off and is now on the way to your pickup location.',
      jsonb_build_object('job_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_notify_queued_next'
  ) THEN
    CREATE TRIGGER trigger_notify_queued_next
      AFTER UPDATE ON jobs
      FOR EACH ROW
      EXECUTE FUNCTION notify_queued_next_status();
  END IF;
END $$;

-- 7. Index for faster active job lookups per courier
CREATE INDEX IF NOT EXISTS idx_jobs_courier_active_status
  ON jobs (assigned_courier_id, status)
  WHERE status IN ('assigned', 'queued_next', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit');
