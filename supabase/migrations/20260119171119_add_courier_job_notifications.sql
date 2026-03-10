/*
  # Add Courier Job Notifications

  ## Overview
  Adds comprehensive notifications for couriers and trucking companies:
  - Notify all couriers when new jobs are posted
  - Notify courier when they place a bid
  - Notify couriers when they get outbid
  - Enhanced bid acceptance notifications

  ## Changes
  1. New Functions
    - notify_couriers_new_job: Notifies all approved couriers when a job is posted
    - notify_courier_bid_placed: Notifies courier when they place a bid
    - notify_couriers_outbid: Notifies previous bidders when a higher bid comes in

  ## Security
    - Uses SECURITY DEFINER for system-level notification creation
    - Maintains RLS policies on notifications table
*/

-- Function to notify all approved couriers when a new job is posted
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
      AND c.user_id != NEW.customer_user_id  -- Don't notify the customer who posted
  LOOP
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_courier_record.user_id,
      'new_job_available',
      'New Job Available!',
      'A new ' || v_job_type || ' delivery job from ' || 
      NEW.pickup_location_text || ' to ' || NEW.dropoff_location_text || 
      CASE 
        WHEN NEW.pricing_type = 'fixed' THEN ' for TTD $' || NEW.price_ttd
        ELSE ''
      END || '.',
      jsonb_build_object(
        'job_id', NEW.id,
        'pricing_type', NEW.pricing_type,
        'price_ttd', NEW.price_ttd
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for notifying couriers about new jobs
DROP TRIGGER IF EXISTS trigger_notify_couriers_new_job ON jobs;
CREATE TRIGGER trigger_notify_couriers_new_job
  AFTER INSERT ON jobs
  FOR EACH ROW
  WHEN (NEW.status = 'open')
  EXECUTE FUNCTION notify_couriers_new_job();

-- Function to notify courier when they place a bid
CREATE OR REPLACE FUNCTION notify_courier_bid_placed()
RETURNS TRIGGER AS $$
DECLARE
  v_courier_user_id uuid;
  v_job_details record;
BEGIN
  -- Only trigger on new bids
  IF TG_OP = 'INSERT' THEN
    -- Get courier user_id
    SELECT user_id INTO v_courier_user_id
    FROM couriers
    WHERE id = NEW.courier_id;

    -- Get job details
    SELECT 
      pickup_location_text,
      dropoff_location_text
    INTO v_job_details
    FROM jobs
    WHERE id = NEW.job_id;

    -- Notify the courier who placed the bid
    IF v_courier_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_courier_user_id,
        'bid_placed',
        'Bid Placed Successfully',
        'Your bid of TTD $' || NEW.amount_ttd || ' for the job from ' ||
        v_job_details.pickup_location_text || ' to ' || v_job_details.dropoff_location_text || 
        ' has been placed.',
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

-- Create trigger for notifying courier when they place a bid
DROP TRIGGER IF EXISTS trigger_notify_courier_bid_placed ON bids;
CREATE TRIGGER trigger_notify_courier_bid_placed
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_courier_bid_placed();

-- Function to notify couriers when they get outbid
CREATE OR REPLACE FUNCTION notify_couriers_outbid()
RETURNS TRIGGER AS $$
DECLARE
  v_outbid_courier_record record;
  v_job_details record;
BEGIN
  -- Only trigger on new bids
  IF TG_OP = 'INSERT' THEN
    -- Get job details
    SELECT 
      pickup_location_text,
      dropoff_location_text
    INTO v_job_details
    FROM jobs
    WHERE id = NEW.job_id;

    -- Find all couriers who have active bids on this job with higher amounts (they got outbid)
    FOR v_outbid_courier_record IN
      SELECT 
        c.user_id,
        b.amount_ttd,
        b.id as bid_id
      FROM bids b
      JOIN couriers c ON c.id = b.courier_id
      WHERE b.job_id = NEW.job_id
        AND b.courier_id != NEW.courier_id  -- Not the new bidder
        AND b.status = 'active'
        AND b.amount_ttd > NEW.amount_ttd  -- They were bidding higher (worse position)
    LOOP
      -- Notify each outbid courier
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_outbid_courier_record.user_id,
        'outbid',
        'You Have Been Outbid!',
        'A lower bid of TTD $' || NEW.amount_ttd || ' has been placed on the job from ' ||
        v_job_details.pickup_location_text || ' to ' || v_job_details.dropoff_location_text || 
        '. Your current bid is TTD $' || v_outbid_courier_record.amount_ttd || '.',
        jsonb_build_object(
          'job_id', NEW.job_id,
          'new_bid_amount', NEW.amount_ttd,
          'your_bid_amount', v_outbid_courier_record.amount_ttd,
          'your_bid_id', v_outbid_courier_record.bid_id
        )
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for notifying couriers when they get outbid
DROP TRIGGER IF EXISTS trigger_notify_couriers_outbid ON bids;
CREATE TRIGGER trigger_notify_couriers_outbid
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_couriers_outbid();
