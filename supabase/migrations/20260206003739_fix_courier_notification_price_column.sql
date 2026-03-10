/*
  # Fix Price Column Reference in Courier Notification Trigger

  ## Problem
  The notify_couriers_new_job function referenced non-existent column `price_ttd`.
  The actual price columns are `customer_offer_ttd`, `base_price`, and `total_price`.

  ## Changes
  1. Updated function to use `customer_offer_ttd` instead of `price_ttd`
  2. No trigger change needed (already correct from previous migration)
*/

CREATE OR REPLACE FUNCTION notify_couriers_new_job()
RETURNS TRIGGER AS $$
DECLARE
  v_record record;
  v_job_type text;
  v_price text;
BEGIN
  v_job_type := CASE 
    WHEN NEW.pricing_type = 'bid' THEN 'bidding'
    ELSE 'fixed price'
  END;

  v_price := COALESCE(NEW.customer_offer_ttd::text, NEW.total_price::text);

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
        WHEN v_price IS NOT NULL THEN ' - TTD $' || v_price
        ELSE ''
      END || '.',
      jsonb_build_object(
        'job_id', NEW.id,
        'pricing_type', NEW.pricing_type,
        'price_ttd', v_price
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
        WHEN v_price IS NOT NULL THEN ' - TTD $' || v_price
        ELSE ''
      END || '.',
      jsonb_build_object(
        'job_id', NEW.id,
        'pricing_type', NEW.pricing_type,
        'price_ttd', v_price,
        'distance_km', NEW.distance_km
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
