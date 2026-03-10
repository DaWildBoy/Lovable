/*
  # Add Arrived Waiting and Loading Cargo Job Statuses

  1. Modified Tables
    - `jobs`
      - Update status constraint to include 'arrived_waiting' and 'loading_cargo'
      - `loading_started_at` (timestamptz) - When the driver confirmed contact and began loading

  2. New Statuses
    - `arrived_waiting` - Driver has arrived, detention/waiting timer is active
    - `loading_cargo` - Driver made contact, loading is in progress, detention timer paused

  3. Notification Triggers
    - When job status changes to 'arrived_waiting': notify customer that driver arrived and timer started
    - When job status changes to 'loading_cargo': notify customer that contact was made and loading began

  4. Important Notes
    - The detention penalty timer runs during 'arrived_waiting' only
    - The detention timer pauses and hides during 'loading_cargo'
    - No auto-cancel or penalty fees apply during 'loading_cargo'
*/

-- 1. Update job status constraint to include new statuses
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

-- 2. Add loading_started_at column to jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'loading_started_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN loading_started_at timestamptz;
  END IF;
END $$;

-- 3. Update the notify_job_status_change function to handle new statuses
CREATE OR REPLACE FUNCTION notify_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_courier_user_id uuid;
  v_courier_name text;
  v_notification_type text;
  v_notification_title text;
  v_notification_message text;
BEGIN
  IF NEW.status != OLD.status THEN
    IF NEW.assigned_courier_id IS NOT NULL THEN
      SELECT user_id INTO v_courier_user_id
      FROM couriers
      WHERE id = NEW.assigned_courier_id;

      SELECT COALESCE(p.full_name, CONCAT_WS(' ', p.first_name, p.last_name), 'Your driver')
      INTO v_courier_name
      FROM profiles p
      WHERE p.id = v_courier_user_id;
    END IF;

    CASE NEW.status
      WHEN 'assigned' THEN
        v_notification_type := 'job_assigned';
        v_notification_title := 'Job Assigned';
        v_notification_message := 'You have been assigned a delivery job from ' ||
          NEW.pickup_location_text || ' to ' || NEW.dropoff_location_text || '.';
        IF v_courier_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, data)
          VALUES (v_courier_user_id, v_notification_type, v_notification_title,
                  v_notification_message, jsonb_build_object('job_id', NEW.id));
        END IF;
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (NEW.customer_user_id, 'job_assigned_customer', 'Courier Assigned',
                'A courier has been assigned to your delivery job.',
                jsonb_build_object('job_id', NEW.id));

      WHEN 'on_way_to_pickup' THEN
        v_notification_type := 'on_way_to_pickup';
        v_notification_title := 'Courier On the Way';
        v_notification_message := 'Your courier is on the way to pickup location.';
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (NEW.customer_user_id, v_notification_type, v_notification_title,
                v_notification_message, jsonb_build_object('job_id', NEW.id));

      WHEN 'arrived_waiting' THEN
        v_notification_type := 'driver_arrived_waiting';
        v_notification_title := 'Driver Has Arrived';
        v_notification_message := COALESCE(v_courier_name, 'Your driver') ||
          ' has arrived at the pickup location and the waiting timer has started. Please meet them immediately.';
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (NEW.customer_user_id, v_notification_type, v_notification_title,
                v_notification_message, jsonb_build_object('job_id', NEW.id));

      WHEN 'loading_cargo' THEN
        v_notification_type := 'loading_cargo';
        v_notification_title := 'Loading In Progress';
        v_notification_message := 'Contact made! ' || COALESCE(v_courier_name, 'Your driver') ||
          ' is currently loading your cargo.';
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (NEW.customer_user_id, v_notification_type, v_notification_title,
                v_notification_message, jsonb_build_object('job_id', NEW.id));

      WHEN 'cargo_collected' THEN
        v_notification_type := 'cargo_collected';
        v_notification_title := 'Cargo Collected';
        v_notification_message := 'Your cargo has been collected and is ready for delivery.';
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (NEW.customer_user_id, v_notification_type, v_notification_title,
                v_notification_message, jsonb_build_object('job_id', NEW.id));

      WHEN 'in_transit' THEN
        v_notification_type := 'in_transit';
        v_notification_title := 'In Transit';
        v_notification_message := 'Your delivery is now in transit to the destination.';
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (NEW.customer_user_id, v_notification_type, v_notification_title,
                v_notification_message, jsonb_build_object('job_id', NEW.id));

      WHEN 'delivered' THEN
        v_notification_type := 'delivered';
        v_notification_title := 'Delivered';
        v_notification_message := 'Your delivery has arrived at the destination. Please confirm completion.';
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (NEW.customer_user_id, v_notification_type, v_notification_title,
                v_notification_message, jsonb_build_object('job_id', NEW.id));

      WHEN 'cancelled' THEN
        v_notification_type := 'job_cancelled';
        v_notification_title := 'Job Cancelled';
        v_notification_message := 'The delivery job has been cancelled.';
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (NEW.customer_user_id, v_notification_type, v_notification_title,
                v_notification_message, jsonb_build_object('job_id', NEW.id));
        IF v_courier_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, data)
          VALUES (v_courier_user_id, v_notification_type, v_notification_title,
                  'A job you were assigned to has been cancelled.',
                  jsonb_build_object('job_id', NEW.id));
        END IF;

      ELSE
        NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
