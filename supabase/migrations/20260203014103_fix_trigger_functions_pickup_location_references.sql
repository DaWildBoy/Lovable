/*
  # Fix Trigger Functions - Replace pickup_location with pickup_location_text

  ## Problem
  Two trigger functions were referencing non-existent columns:
  - NEW.pickup_location (doesn't exist)
  - NEW.dropoff_location (doesn't exist)
  
  This caused errors when jobs were updated: "record 'new' has no field 'pickup_location'" (code 42703)

  ## Solution
  Update the trigger functions to use the correct column names:
  - NEW.pickup_location_text (exists)
  - NEW.dropoff_location_text (exists)

  ## Changes
  1. Fix notify_couriers_new_job function
  2. Fix notify_haulage_assignment function
*/

-- Fix notify_couriers_new_job function
CREATE OR REPLACE FUNCTION notify_couriers_new_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
        NEW.pickup_location_text,
        NEW.dropoff_location_text,
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
        NEW.pickup_location_text,
        NEW.dropoff_location_text,
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
$$;

-- Fix notify_haulage_assignment function
CREATE OR REPLACE FUNCTION notify_haulage_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_user_id uuid;
BEGIN
  -- Only process when job is being assigned to a haulage company
  IF NEW.status = 'assigned' 
     AND NEW.assigned_company_id IS NOT NULL 
     AND NEW.assignment_type = 'haulage_dispatch'
     AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN

    -- Get the company user ID (the company itself is the user)
    v_company_user_id := NEW.assigned_company_id;

    -- Create notification for the haulage company
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      created_at
    ) VALUES (
      v_company_user_id,
      'job_assigned',
      'Job Accepted & Assigned',
      format('Successfully assigned job to %s - %s to %s (TTD $%s)',
        NEW.assigned_driver_name,
        NEW.pickup_location_text,
        NEW.dropoff_location_text,
        NEW.customer_offer_ttd
      ),
      jsonb_build_object(
        'job_id', NEW.id,
        'driver_name', NEW.assigned_driver_name,
        'vehicle_label', NEW.assigned_vehicle_label,
        'customer_offer_ttd', NEW.customer_offer_ttd,
        'distance_km', NEW.distance_km,
        'pickup_location', NEW.pickup_location_text,
        'dropoff_location', NEW.dropoff_location_text
      ),
      NOW()
    );
  END IF;

  RETURN NEW;
END;
$$;
