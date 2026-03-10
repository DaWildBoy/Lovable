/*
  # Add Haulage Company Job Notifications

  ## Overview
  Extends the job notification system to also notify haulage companies when new jobs are posted.
  Previously, only couriers in the couriers table were notified. Now both couriers and
  approved haulage companies will receive notifications about new jobs.

  ## Changes
  1. Updates notify_couriers_new_job function to also query haulage companies
  2. Sends notifications to all approved haulage companies (business_verification_status = 'approved')
  3. Maintains existing courier notifications

  ## Security
  - Uses SECURITY DEFINER for system-level notification creation
  - Maintains RLS policies on notifications table
  - Only notifies approved haulage companies
*/

-- Update function to notify both couriers and haulage companies
CREATE OR REPLACE FUNCTION notify_couriers_new_job()
RETURNS TRIGGER AS $$
DECLARE
  v_record record;
  v_job_type text;
BEGIN
  -- Determine job type based on pricing
  v_job_type := CASE 
    WHEN NEW.pricing_type = 'bid' THEN 'bidding'
    ELSE 'fixed price'
  END;

  -- Notify all approved couriers
  FOR v_record IN 
    SELECT c.user_id, c.id as courier_id
    FROM couriers c
    WHERE c.verification_status = 'approved'
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_record.user_id,
      'job_available',
      'New Job Available',
      format('New %s job posted: %s to %s - TTD $%s', 
        v_job_type,
        NEW.pickup_location,
        NEW.dropoff_location,
        NEW.customer_offer_ttd
      ),
      jsonb_build_object(
        'job_id', NEW.id,
        'pricing_type', NEW.pricing_type,
        'customer_offer_ttd', NEW.customer_offer_ttd,
        'distance_km', NEW.distance_km
      ),
      NOW()
    );
  END LOOP;

  -- Also notify all approved haulage companies
  FOR v_record IN
    SELECT p.id as user_id
    FROM profiles p
    WHERE p.role = 'business'
    AND p.business_type = 'haulage'
    AND p.business_verification_status = 'approved'
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data, created_at)
    VALUES (
      v_record.user_id,
      'job_available',
      'New Delivery Available',
      format('New %s delivery: %s to %s - TTD $%s', 
        v_job_type,
        NEW.pickup_location,
        NEW.dropoff_location,
        NEW.customer_offer_ttd
      ),
      jsonb_build_object(
        'job_id', NEW.id,
        'pricing_type', NEW.pricing_type,
        'customer_offer_ttd', NEW.customer_offer_ttd,
        'distance_km', NEW.distance_km
      ),
      NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
