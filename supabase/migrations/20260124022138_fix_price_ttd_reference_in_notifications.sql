/*
  # Fix price_ttd Reference in Notification Triggers

  ## Overview
  Fixes the notification trigger that references the non-existent `price_ttd` field.
  The correct field name is `customer_offer_ttd`.

  ## Changes
  1. Updates notify_couriers_new_job function to use customer_offer_ttd
  2. Fixes reference in notification data payload
*/

-- Function to notify all approved couriers when a new job is posted (FIXED)
CREATE OR REPLACE FUNCTION notify_couriers_new_job()
RETURNS TRIGGER AS $$
DECLARE
  v_courier_record record;
  v_job_type text;
BEGIN
  -- Determine job type based on pricing
  v_job_type := CASE 
    WHEN NEW.pricing_type = 'bid' THEN 'bidding'
    ELSE 'fixed price'
  END;

  -- Notify all approved couriers
  FOR v_courier_record IN 
    SELECT c.user_id, c.id as courier_id
    FROM couriers c
    WHERE c.verification_status = 'approved'
      AND c.user_id != NEW.customer_user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_courier_record.user_id,
      'new_job_available',
      'New Job Available!',
      'A new ' || v_job_type || ' delivery job from ' || 
      NEW.pickup_location_text || ' to ' || NEW.dropoff_location_text || 
      CASE 
        WHEN NEW.pricing_type = 'fixed' THEN ' for TTD $' || NEW.customer_offer_ttd
        ELSE ''
      END || '.',
      jsonb_build_object(
        'job_id', NEW.id,
        'pricing_type', NEW.pricing_type,
        'price_ttd', NEW.customer_offer_ttd
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
