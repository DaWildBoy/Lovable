/*
  # Add "Order on the way" Notification

  ## Overview
  Adds notification trigger when pickup is collected to notify customer that tracking is now active.

  ## Changes
  1. New Function
    - notify_tracking_started: Sends "Order on the way - Track now" notification when pickup collected

  ## Trigger Logic
  - Fires when a PICKUP delivery_stop status changes to COMPLETED
  - Sends notification to job owner (customer/retail)
  - Notification includes deep link to job details page
*/

-- Create function to notify when tracking starts (pickup collected)
CREATE OR REPLACE FUNCTION notify_tracking_started()
RETURNS TRIGGER AS $$
DECLARE
  v_job_record record;
  v_all_pickups_collected boolean;
BEGIN
  -- Only trigger when a PICKUP stop is marked as COMPLETED
  IF NEW.stop_type = 'PICKUP' AND NEW.status = 'COMPLETED' AND (OLD.status IS NULL OR OLD.status != 'COMPLETED') THEN
    
    -- Get job details
    SELECT
      j.id,
      j.customer_user_id,
      j.pickup_location_text,
      j.dropoff_location_text
    INTO v_job_record
    FROM jobs j
    WHERE j.id = NEW.job_id;

    -- Check if ALL pickups for this job are now collected
    SELECT NOT EXISTS (
      SELECT 1
      FROM delivery_stops ds
      WHERE ds.job_id = NEW.job_id
      AND ds.stop_type = 'PICKUP'
      AND ds.status != 'COMPLETED'
    ) INTO v_all_pickups_collected;

    -- Only send notification if ALL pickups are now collected
    IF v_all_pickups_collected AND v_job_record.customer_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_job_record.customer_user_id,
        'tracking_started',
        'Order on the way',
        'Your driver has collected the cargo. Track your delivery in real time.',
        jsonb_build_object(
          'job_id', v_job_record.id,
          'action', 'track_now',
          'pickup_location', v_job_record.pickup_location_text
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for tracking started
DROP TRIGGER IF EXISTS trigger_notify_tracking_started ON delivery_stops;
CREATE TRIGGER trigger_notify_tracking_started
  AFTER UPDATE ON delivery_stops
  FOR EACH ROW
  EXECUTE FUNCTION notify_tracking_started();

-- Add comment
COMMENT ON FUNCTION notify_tracking_started IS 'Sends notification to customer when pickup is collected and live tracking begins';
