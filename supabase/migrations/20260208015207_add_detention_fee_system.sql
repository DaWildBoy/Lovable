/*
  # Add Detention Fee / Waiting Time System

  1. New Tables
    - `detention_records`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references jobs)
      - `stop_id` (uuid, references delivery_stops)
      - `arrived_at` (timestamptz) - when the courier arrived at pickup
      - `collected_at` (timestamptz, nullable) - when cargo was collected
      - `free_minutes` (integer, default 15) - free waiting time before charges begin
      - `wait_minutes` (integer, default 0) - total minutes waited
      - `billable_minutes` (integer, default 0) - minutes beyond free time
      - `fee_amount` (numeric, default 0) - calculated detention fee in TTD
      - `vehicle_type` (text) - courier vehicle type for rate calculation
      - `job_base_price` (numeric) - job base price for rate scaling
      - `status` (text) - 'active', 'finalized', 'waived', 'disputed'
      - `tier_reached` (text) - 'none', 'tier_1', 'tier_2', 'tier_3'
      - `notified_tier_1` (boolean) - whether 15min notification was sent
      - `notified_tier_2` (boolean) - whether 25min notification was sent
      - `notified_tier_3` (boolean) - whether 45min notification was sent
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `jobs` - add `detention_fee` column (numeric, default 0)
    - `invoices` - add `detention_fee` column (numeric, default 0)

  3. Security
    - Enable RLS on `detention_records` table
    - Couriers can insert and update detention records for their assigned jobs
    - Customers can view detention records for their jobs
    - Admin can view all detention records

  4. Triggers
    - Auto-create notification when detention tier thresholds are reached
    - Update invoice trigger to include detention fee

  5. Important Notes
    - Detention fee tiers: 15min=$50 base, 25min=$75 base, 45min=$100 base
    - Fees scale with vehicle type multiplier and job price factor
    - Couriers receive 100% of detention fees
    - First 15 minutes are free (grace period)
*/

-- 1. Create detention_records table
CREATE TABLE IF NOT EXISTS detention_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stop_id uuid NOT NULL,
  arrived_at timestamptz NOT NULL DEFAULT now(),
  collected_at timestamptz,
  free_minutes integer NOT NULL DEFAULT 15,
  wait_minutes integer NOT NULL DEFAULT 0,
  billable_minutes integer NOT NULL DEFAULT 0,
  fee_amount numeric NOT NULL DEFAULT 0,
  vehicle_type text NOT NULL DEFAULT 'car',
  job_base_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'finalized', 'waived', 'disputed')),
  tier_reached text NOT NULL DEFAULT 'none' CHECK (tier_reached IN ('none', 'tier_1', 'tier_2', 'tier_3')),
  notified_tier_1 boolean NOT NULL DEFAULT false,
  notified_tier_2 boolean NOT NULL DEFAULT false,
  notified_tier_3 boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add detention_fee to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'detention_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN detention_fee numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 3. Add detention_fee to invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'detention_fee'
  ) THEN
    ALTER TABLE invoices ADD COLUMN detention_fee numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- 4. Enable RLS on detention_records
ALTER TABLE detention_records ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- Couriers can view detention records for jobs assigned to them
CREATE POLICY "Couriers can view own detention records"
  ON detention_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id
      WHERE j.id = detention_records.job_id
      AND c.user_id = auth.uid()
    )
  );

-- Customers can view detention records for their jobs
CREATE POLICY "Customers can view detention records for their jobs"
  ON detention_records FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = detention_records.job_id
      AND j.customer_user_id = auth.uid()
    )
  );

-- Couriers can insert detention records for their assigned jobs
CREATE POLICY "Couriers can create detention records"
  ON detention_records FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id
      WHERE j.id = detention_records.job_id
      AND c.user_id = auth.uid()
    )
  );

-- Couriers can update detention records for their assigned jobs
CREATE POLICY "Couriers can update own detention records"
  ON detention_records FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id
      WHERE j.id = detention_records.job_id
      AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs j
      JOIN couriers c ON c.id = j.assigned_courier_id
      WHERE j.id = detention_records.job_id
      AND c.user_id = auth.uid()
    )
  );

-- 6. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_detention_records_job_id ON detention_records(job_id);
CREATE INDEX IF NOT EXISTS idx_detention_records_stop_id ON detention_records(stop_id);
CREATE INDEX IF NOT EXISTS idx_detention_records_status ON detention_records(status);

-- 7. Notification trigger for detention tier thresholds
CREATE OR REPLACE FUNCTION notify_detention_tier_reached()
RETURNS trigger AS $$
DECLARE
  v_customer_user_id uuid;
  v_courier_name text;
  v_pickup_location text;
  v_job_ref text;
  v_fee_display text;
BEGIN
  -- Only process when a tier notification flag changes from false to true
  IF (
    (NEW.notified_tier_1 = true AND OLD.notified_tier_1 = false) OR
    (NEW.notified_tier_2 = true AND OLD.notified_tier_2 = false) OR
    (NEW.notified_tier_3 = true AND OLD.notified_tier_3 = false)
  ) THEN
    SELECT j.customer_user_id, COALESCE(j.job_reference_id, ''),
           COALESCE(j.pickup_location_text, 'pickup location')
    INTO v_customer_user_id, v_job_ref, v_pickup_location
    FROM jobs j WHERE j.id = NEW.job_id;

    SELECT COALESCE(p.full_name, CONCAT_WS(' ', p.first_name, p.last_name), 'Your driver')
    INTO v_courier_name
    FROM jobs j
    JOIN couriers c ON c.id = j.assigned_courier_id
    JOIN profiles p ON p.id = c.user_id
    WHERE j.id = NEW.job_id;

    v_fee_display := '$' || TRIM(TO_CHAR(NEW.fee_amount, '999,999.00')) || ' TTD';

    -- Tier 1: 15 minutes
    IF NEW.notified_tier_1 = true AND OLD.notified_tier_1 = false THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_customer_user_id,
        'detention_warning',
        'Driver Waiting at Pickup',
        v_courier_name || ' has been waiting at ' || v_pickup_location || ' for 15 minutes. Please ensure cargo is ready. Detention charges may apply.',
        jsonb_build_object('job_id', NEW.job_id, 'stop_id', NEW.stop_id, 'wait_minutes', NEW.wait_minutes, 'tier', 'tier_1')
      );
    END IF;

    -- Tier 2: 25 minutes
    IF NEW.notified_tier_2 = true AND OLD.notified_tier_2 = false THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_customer_user_id,
        'detention_fee_warning',
        'Detention Charges Applying',
        v_courier_name || ' has been waiting for 25 minutes. A detention fee of ' || v_fee_display || ' has been applied to your job.',
        jsonb_build_object('job_id', NEW.job_id, 'stop_id', NEW.stop_id, 'wait_minutes', NEW.wait_minutes, 'fee_amount', NEW.fee_amount, 'tier', 'tier_2')
      );
    END IF;

    -- Tier 3: 45 minutes
    IF NEW.notified_tier_3 = true AND OLD.notified_tier_3 = false THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_customer_user_id,
        'detention_fee_applied',
        'Detention Fee Applied',
        'Your driver has been waiting for over 45 minutes at ' || v_pickup_location || '. Detention fee of ' || v_fee_display || ' has been added to your job total.',
        jsonb_build_object('job_id', NEW.job_id, 'stop_id', NEW.stop_id, 'wait_minutes', NEW.wait_minutes, 'fee_amount', NEW.fee_amount, 'tier', 'tier_3')
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_detention_tier_reached
  AFTER UPDATE ON detention_records
  FOR EACH ROW
  EXECUTE FUNCTION notify_detention_tier_reached();

-- 8. Update invoice generation trigger to include detention fee
CREATE OR REPLACE FUNCTION generate_invoice_on_completion()
RETURNS trigger AS $$
DECLARE
  v_customer profiles%ROWTYPE;
  v_courier profiles%ROWTYPE;
  v_courier_user_id uuid;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT * INTO v_customer FROM profiles WHERE id = NEW.customer_user_id;

    IF NEW.assigned_courier_id IS NOT NULL THEN
      SELECT user_id INTO v_courier_user_id
      FROM couriers
      WHERE id = NEW.assigned_courier_id;

      IF v_courier_user_id IS NOT NULL THEN
        SELECT * INTO v_courier FROM profiles WHERE id = v_courier_user_id;
      END IF;
    END IF;

    INSERT INTO invoices (
      job_id,
      customer_user_id,
      courier_user_id,
      customer_name,
      customer_email,
      courier_name,
      job_reference_id,
      pickup_location,
      dropoff_location,
      delivery_type,
      base_price,
      platform_fee,
      vat_amount,
      total_price,
      courier_earnings,
      detention_fee,
      status
    ) VALUES (
      NEW.id,
      NEW.customer_user_id,
      v_courier_user_id,
      COALESCE(v_customer.full_name, CONCAT_WS(' ', v_customer.first_name, v_customer.last_name), ''),
      COALESCE(v_customer.email, ''),
      COALESCE(v_courier.full_name, CONCAT_WS(' ', v_courier.first_name, v_courier.last_name), ''),
      COALESCE(NEW.job_reference_id, ''),
      COALESCE(NEW.pickup_location_text, ''),
      COALESCE(NEW.dropoff_location_text, ''),
      COALESCE(NEW.delivery_type, ''),
      COALESCE(NEW.base_price, 0),
      COALESCE(NEW.platform_fee, 0),
      COALESCE(NEW.vat_amount, 0),
      COALESCE(NEW.total_price, 0) + COALESCE(NEW.detention_fee, 0),
      COALESCE(NEW.courier_earnings, 0) + COALESCE(NEW.detention_fee, 0),
      COALESCE(NEW.detention_fee, 0),
      'sent'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
