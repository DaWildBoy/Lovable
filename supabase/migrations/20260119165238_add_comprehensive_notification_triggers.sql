/*
  # Add Comprehensive Notification Triggers

  ## Overview
  Adds notification triggers for all key events in the delivery lifecycle:
  - Offer/bid accepted by customer
  - Courier assigned to job
  - All delivery progress steps (on way to pickup, cargo collected, in transit, delivered)
  - Job status changes

  ## Changes
  1. New Triggers
    - notify_bid_accepted: When customer accepts a bid
    - notify_job_status_change: For all job status transitions
    - notify_delivery_progress: For delivery milestone updates

  ## Security
    - Uses SECURITY DEFINER for system-level notification creation
    - Maintains RLS policies on notifications table
*/

-- Create function to notify when a bid is accepted
CREATE OR REPLACE FUNCTION notify_bid_accepted()
RETURNS TRIGGER AS $$
DECLARE
  v_courier_user_id uuid;
  v_job_details record;
BEGIN
  -- Only trigger when bid status changes to 'accepted'
  IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
    -- Get courier user_id from courier_id
    SELECT c.user_id INTO v_courier_user_id
    FROM couriers c
    WHERE c.id = NEW.courier_id;

    -- Get job details
    SELECT
      pickup_location_text,
      dropoff_location_text
    INTO v_job_details
    FROM jobs
    WHERE id = NEW.job_id;

    -- Notify the courier
    IF v_courier_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_courier_user_id,
        'bid_accepted',
        'Bid Accepted!',
        'Your bid of TTD $' || NEW.amount_ttd || ' has been accepted. Job from ' ||
        v_job_details.pickup_location_text || ' to ' || v_job_details.dropoff_location_text || '.',
        jsonb_build_object(
          'job_id', NEW.job_id,
          'bid_id', NEW.id,
          'amount_ttd', NEW.amount_ttd
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for bid accepted
DROP TRIGGER IF EXISTS trigger_notify_bid_accepted ON bids;
CREATE TRIGGER trigger_notify_bid_accepted
  AFTER UPDATE ON bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_bid_accepted();

-- Create function to notify on job status changes
CREATE OR REPLACE FUNCTION notify_job_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_courier_user_id uuid;
  v_notification_type text;
  v_notification_title text;
  v_notification_message text;
BEGIN
  -- Only proceed if status has actually changed
  IF NEW.status != OLD.status THEN
    -- Get courier user_id if assigned
    IF NEW.assigned_courier_id IS NOT NULL THEN
      SELECT user_id INTO v_courier_user_id
      FROM couriers
      WHERE id = NEW.assigned_courier_id;
    END IF;

    -- Determine notification details based on status
    CASE NEW.status
      WHEN 'assigned' THEN
        v_notification_type := 'job_assigned';
        v_notification_title := 'Job Assigned';
        v_notification_message := 'You have been assigned a delivery job from ' ||
          NEW.pickup_location_text || ' to ' || NEW.dropoff_location_text || '.';

        -- Notify courier
        IF v_courier_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, data)
          VALUES (
            v_courier_user_id,
            v_notification_type,
            v_notification_title,
            v_notification_message,
            jsonb_build_object('job_id', NEW.id)
          );
        END IF;

        -- Also notify customer
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          NEW.customer_user_id,
          'job_assigned_customer',
          'Courier Assigned',
          'A courier has been assigned to your delivery job.',
          jsonb_build_object('job_id', NEW.id)
        );

      WHEN 'on_way_to_pickup' THEN
        v_notification_type := 'on_way_to_pickup';
        v_notification_title := 'Courier On the Way';
        v_notification_message := 'Your courier is on the way to pickup location.';

        -- Notify customer
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          NEW.customer_user_id,
          v_notification_type,
          v_notification_title,
          v_notification_message,
          jsonb_build_object('job_id', NEW.id)
        );

      WHEN 'cargo_collected' THEN
        v_notification_type := 'cargo_collected';
        v_notification_title := 'Cargo Collected';
        v_notification_message := 'Your cargo has been collected and is ready for delivery.';

        -- Notify customer
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          NEW.customer_user_id,
          v_notification_type,
          v_notification_title,
          v_notification_message,
          jsonb_build_object('job_id', NEW.id)
        );

      WHEN 'in_transit' THEN
        v_notification_type := 'in_transit';
        v_notification_title := 'In Transit';
        v_notification_message := 'Your delivery is now in transit to the destination.';

        -- Notify customer
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          NEW.customer_user_id,
          v_notification_type,
          v_notification_title,
          v_notification_message,
          jsonb_build_object('job_id', NEW.id)
        );

      WHEN 'delivered' THEN
        v_notification_type := 'delivered';
        v_notification_title := 'Delivered';
        v_notification_message := 'Your delivery has arrived at the destination. Please confirm completion.';

        -- Notify customer
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          NEW.customer_user_id,
          v_notification_type,
          v_notification_title,
          v_notification_message,
          jsonb_build_object('job_id', NEW.id)
        );

      WHEN 'cancelled' THEN
        v_notification_type := 'job_cancelled';
        v_notification_title := 'Job Cancelled';
        v_notification_message := 'The delivery job has been cancelled.';

        -- Notify both customer and courier if assigned
        INSERT INTO notifications (user_id, type, title, message, data)
        VALUES (
          NEW.customer_user_id,
          v_notification_type,
          v_notification_title,
          v_notification_message,
          jsonb_build_object('job_id', NEW.id)
        );

        IF v_courier_user_id IS NOT NULL THEN
          INSERT INTO notifications (user_id, type, title, message, data)
          VALUES (
            v_courier_user_id,
            v_notification_type,
            v_notification_title,
            'A job you were assigned to has been cancelled.',
            jsonb_build_object('job_id', NEW.id)
          );
        END IF;

      ELSE
        -- Do nothing for other status changes
        NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for job status changes
DROP TRIGGER IF EXISTS trigger_notify_job_status_change ON jobs;
CREATE TRIGGER trigger_notify_job_status_change
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_job_status_change();
