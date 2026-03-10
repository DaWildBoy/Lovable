/*
  # Fix Courier & Haulage Job Notification Trigger

  ## Problem
  1. Trigger only fired when job status = 'open', missing 'bidding' jobs
  2. Function referenced non-existent columns (pickup_location, dropoff_location)
     instead of correct columns (pickup_location_text, dropoff_location_text)

  ## Changes
  1. Updated notify_couriers_new_job function with correct column references
  2. Recreated trigger to fire for both 'open' AND 'bidding' status jobs
  3. Both couriers and haulage companies now get notified for all new jobs

  ## Security
  - Maintains SECURITY DEFINER for system-level notification creation
  - No changes to RLS policies
*/

CREATE OR REPLACE FUNCTION notify_couriers_new_job()
RETURNS TRIGGER AS $$
DECLARE
  v_record record;
  v_job_type text;
BEGIN
  v_job_type := CASE 
    WHEN NEW.pricing_type = 'bid' THEN 'bidding'
    ELSE 'fixed price'
  END;

  FOR v_record IN 
    SELECT c.user_id
    FROM couriers c
    WHERE c.verification_status = 'approved'
      AND c.user_id != NEW.customer_user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_record.user_id,
      'new_job_available',
      'New Job Available!',
      'A new ' || v_job_type || ' delivery job from ' || 
      COALESCE(NEW.pickup_location_text, 'Unknown') || ' to ' || 
      COALESCE(NEW.dropoff_location_text, 'Unknown') || 
      CASE 
        WHEN NEW.pricing_type = 'fixed' AND NEW.price_ttd IS NOT NULL 
          THEN ' for TTD $' || NEW.price_ttd
        WHEN NEW.customer_offer_ttd IS NOT NULL
          THEN ' - TTD $' || NEW.customer_offer_ttd
        ELSE ''
      END || '.',
      jsonb_build_object(
        'job_id', NEW.id,
        'pricing_type', NEW.pricing_type,
        'price_ttd', COALESCE(NEW.price_ttd, NEW.customer_offer_ttd)
      )
    );
  END LOOP;

  FOR v_record IN
    SELECT p.id as user_id
    FROM profiles p
    WHERE p.role = 'business'
      AND p.business_type = 'haulage'
      AND p.business_verification_status = 'approved'
      AND p.id != NEW.customer_user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_record.user_id,
      'job_available',
      'New Delivery Available',
      'A new ' || v_job_type || ' delivery from ' || 
      COALESCE(NEW.pickup_location_text, 'Unknown') || ' to ' || 
      COALESCE(NEW.dropoff_location_text, 'Unknown') || 
      CASE 
        WHEN NEW.pricing_type = 'fixed' AND NEW.price_ttd IS NOT NULL 
          THEN ' for TTD $' || NEW.price_ttd
        WHEN NEW.customer_offer_ttd IS NOT NULL
          THEN ' - TTD $' || NEW.customer_offer_ttd
        ELSE ''
      END || '.',
      jsonb_build_object(
        'job_id', NEW.id,
        'pricing_type', NEW.pricing_type,
        'price_ttd', COALESCE(NEW.price_ttd, NEW.customer_offer_ttd),
        'distance_km', NEW.distance_km
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_couriers_new_job ON jobs;
CREATE TRIGGER trigger_notify_couriers_new_job
  AFTER INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.status IN ('open', 'bidding'))
  EXECUTE FUNCTION notify_couriers_new_job();
