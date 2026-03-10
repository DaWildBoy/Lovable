/*
  # Add Delivery Return / Failed Delivery System

  1. Modified Tables
    - `jobs`
      - `return_reason` (text, nullable) - Why the delivery failed:
        - 'customer_refused' - Customer refused the item
        - 'item_does_not_fit' - Item does not fit at destination
        - 'wrong_address_unavailable' - Wrong address or customer unavailable
        - 'item_damaged' - Item was found damaged
      - `return_notes` (text, nullable) - Optional driver note (e.g. "Doorframe too narrow")
      - `return_fee` (numeric, default 0) - 50% of original trip fare charged for return trip
      - `return_initiated_at` (timestamptz, nullable) - When the return was initiated
      - `original_dropoff_location_text` (text, nullable) - Snapshot of original dropoff before route flip
      - `original_dropoff_lat` (numeric, nullable) - Original dropoff latitude
      - `original_dropoff_lng` (numeric, nullable) - Original dropoff longitude
    - Status constraint updated to include 'returning'

  2. Security
    - Existing RLS policies on jobs table continue to apply
    - Notification trigger fires automatically when status becomes 'returning'

  3. Notifications
    - Customer/retailer notified when job enters 'returning' status with reason and fee
    - Driver notified with return confirmation banner

  4. Important Notes
    - Return fee is calculated as 50% of customer_offer_ttd
    - Fee is added to both total_price and courier_earnings
    - Invoice generation trigger already handles completed jobs; return fee is included in totals
    - The 'returning' status is a new workflow state between in_progress and completed
*/

-- Add 'returning' to allowed job statuses
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
      'on_way_to_pickup'::text,
      'cargo_collected'::text,
      'in_transit'::text,
      'delivered'::text,
      'in_progress'::text,
      'returning'::text,
      'completed'::text,
      'cancelled'::text
    ]));
END $$;

-- Add return-related columns to jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'return_reason'
  ) THEN
    ALTER TABLE jobs ADD COLUMN return_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'return_notes'
  ) THEN
    ALTER TABLE jobs ADD COLUMN return_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'return_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN return_fee numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'return_initiated_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN return_initiated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'original_dropoff_location_text'
  ) THEN
    ALTER TABLE jobs ADD COLUMN original_dropoff_location_text text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'original_dropoff_lat'
  ) THEN
    ALTER TABLE jobs ADD COLUMN original_dropoff_lat numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'original_dropoff_lng'
  ) THEN
    ALTER TABLE jobs ADD COLUMN original_dropoff_lng numeric;
  END IF;
END $$;

-- Notification trigger: notify customer when job enters 'returning' status
CREATE OR REPLACE FUNCTION notify_delivery_return_initiated()
RETURNS TRIGGER AS $$
DECLARE
  v_courier_name text;
  v_reason_text text;
  v_job_ref text;
BEGIN
  IF NEW.status = 'returning' AND OLD.status != 'returning' THEN
    SELECT COALESCE(full_name, first_name || ' ' || last_name, 'Driver')
    INTO v_courier_name
    FROM profiles
    WHERE id = NEW.assigned_courier_id;

    v_job_ref := COALESCE(NEW.job_reference_id, LEFT(NEW.id::text, 8));

    CASE NEW.return_reason
      WHEN 'customer_refused' THEN v_reason_text := 'Customer Refused Item';
      WHEN 'item_does_not_fit' THEN v_reason_text := 'Item Does Not Fit';
      WHEN 'wrong_address_unavailable' THEN v_reason_text := 'Wrong Address / Customer Unavailable';
      WHEN 'item_damaged' THEN v_reason_text := 'Item Damaged';
      ELSE v_reason_text := COALESCE(NEW.return_reason, 'Unknown');
    END CASE;

    -- Notify customer/retailer
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      NEW.customer_user_id,
      'delivery_return',
      'Delivery Returning to Base',
      'Job #' || v_job_ref || ' is returning to base. Reason: ' || v_reason_text || '. Return fee of $' || COALESCE(NEW.return_fee, 0) || ' TTD applied.',
      jsonb_build_object(
        'job_id', NEW.id,
        'return_reason', NEW.return_reason,
        'return_notes', COALESCE(NEW.return_notes, ''),
        'return_fee', COALESCE(NEW.return_fee, 0),
        'courier_name', v_courier_name
      )
    );

    -- Notify driver with confirmation
    IF NEW.assigned_courier_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data
      ) VALUES (
        NEW.assigned_courier_id,
        'delivery_return_confirmed',
        'Return Trip Initiated',
        'Return initiated for Job #' || v_job_ref || '. Please take item back to pickup point. Return fee of $' || COALESCE(NEW.return_fee, 0) || ' TTD earned.',
        jsonb_build_object(
          'job_id', NEW.id,
          'return_fee', COALESCE(NEW.return_fee, 0),
          'pickup_location', COALESCE(NEW.pickup_location_text, '')
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_delivery_return ON jobs;
CREATE TRIGGER trigger_notify_delivery_return
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_delivery_return_initiated();

-- Index for querying returning jobs
CREATE INDEX IF NOT EXISTS idx_jobs_returning_status ON jobs(status) WHERE status = 'returning';
