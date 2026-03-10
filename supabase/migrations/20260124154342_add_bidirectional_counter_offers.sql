/*
  # Add Bidirectional Counter Offers Support

  1. Changes
    - Add `offered_by_role` column to track who made the counter offer (customer/business or courier)
    - Update RLS policies to allow customers/businesses to create counter offers
    - Update notification functions to handle bidirectional counter offers
    - Allow customers to counter a courier's counter offer

  2. Purpose
    - Enable negotiation where both parties can make counter offers
    - Customer posts job at $250, courier offers $200, customer can counter with $220
    - Creates a negotiation flow between customer and courier
*/

-- Add offered_by_role column to track who made the offer
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'counter_offers' AND column_name = 'offered_by_role'
  ) THEN
    ALTER TABLE counter_offers
    ADD COLUMN offered_by_role text NOT NULL DEFAULT 'courier'
    CHECK (offered_by_role IN ('customer', 'business', 'courier'));
  END IF;
END $$;

-- Drop existing policies that only allow couriers
DROP POLICY IF EXISTS "Couriers can create counter offers" ON counter_offers;
DROP POLICY IF EXISTS "Couriers can view own counter offers" ON counter_offers;
DROP POLICY IF EXISTS "Job owners can view counter offers" ON counter_offers;
DROP POLICY IF EXISTS "Job owners can update counter offers" ON counter_offers;
DROP POLICY IF EXISTS "Couriers can update own counter offers" ON counter_offers;

-- New policy: Users can create counter offers if they're the courier OR the job owner
CREATE POLICY "Users can create counter offers"
  ON counter_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND (
      -- Couriers can create counter offers
      (offered_by_role = 'courier' AND EXISTS (
        SELECT 1 FROM couriers
        WHERE couriers.user_id = auth.uid()
        AND couriers.id = counter_offers.courier_id
      ))
      OR
      -- Job owners can create counter offers (customer or business)
      ((offered_by_role = 'customer' OR offered_by_role = 'business') AND EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.id = counter_offers.job_id
        AND jobs.customer_user_id = auth.uid()
      ))
    )
  );

-- Users can view counter offers they created OR counter offers for their jobs/courier profile
CREATE POLICY "Users can view relevant counter offers"
  ON counter_offers
  FOR SELECT
  TO authenticated
  USING (
    -- View own counter offers
    auth.uid() = user_id
    OR
    -- View counter offers for jobs you own
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = counter_offers.job_id
      AND jobs.customer_user_id = auth.uid()
    )
    OR
    -- View counter offers for your courier profile
    EXISTS (
      SELECT 1 FROM couriers
      WHERE couriers.id = counter_offers.courier_id
      AND couriers.user_id = auth.uid()
    )
  );

-- Users can update counter offers if they're the recipient
CREATE POLICY "Users can update counter offers"
  ON counter_offers
  FOR UPDATE
  TO authenticated
  USING (
    -- Job owners can update courier offers (accept/reject)
    (offered_by_role = 'courier' AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = counter_offers.job_id
      AND jobs.customer_user_id = auth.uid()
    ))
    OR
    -- Couriers can update customer/business offers (accept/reject)
    ((offered_by_role = 'customer' OR offered_by_role = 'business') AND EXISTS (
      SELECT 1 FROM couriers
      WHERE couriers.id = counter_offers.courier_id
      AND couriers.user_id = auth.uid()
    ))
    OR
    -- Users can update their own counter offers (withdraw)
    auth.uid() = user_id
  )
  WITH CHECK (
    -- Same as USING clause
    (offered_by_role = 'courier' AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = counter_offers.job_id
      AND jobs.customer_user_id = auth.uid()
    ))
    OR
    ((offered_by_role = 'customer' OR offered_by_role = 'business') AND EXISTS (
      SELECT 1 FROM couriers
      WHERE couriers.id = counter_offers.courier_id
      AND couriers.user_id = auth.uid()
    ))
    OR
    auth.uid() = user_id
  );

-- Update notification function to handle bidirectional counter offers
CREATE OR REPLACE FUNCTION notify_counter_offer_received()
RETURNS TRIGGER AS $$
DECLARE
  v_recipient_user_id uuid;
  v_sender_name text;
BEGIN
  -- Determine recipient based on who made the offer
  IF NEW.offered_by_role = 'courier' THEN
    -- Courier made offer, notify customer
    SELECT customer_user_id INTO v_recipient_user_id
    FROM jobs
    WHERE id = NEW.job_id;

    SELECT profiles.full_name INTO v_sender_name
    FROM couriers
    JOIN profiles ON profiles.id = couriers.user_id
    WHERE couriers.id = NEW.courier_id;
  ELSE
    -- Customer made offer, notify courier
    SELECT user_id INTO v_recipient_user_id
    FROM couriers
    WHERE id = NEW.courier_id;

    SELECT profiles.full_name INTO v_sender_name
    FROM jobs
    JOIN profiles ON profiles.id = jobs.customer_user_id
    WHERE jobs.id = NEW.job_id;
  END IF;

  -- Insert notification for recipient
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_recipient_user_id,
    'counter_offer_received',
    'New Counter Offer Received',
    COALESCE(v_sender_name, 'Someone') || ' has submitted a counter offer of TTD $' || NEW.amount_ttd || ' for the job.',
    jsonb_build_object(
      'job_id', NEW.job_id,
      'counter_offer_id', NEW.id,
      'amount_ttd', NEW.amount_ttd,
      'offered_by_role', NEW.offered_by_role
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notification function remains the same for status updates
CREATE OR REPLACE FUNCTION notify_counter_offer_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status AND NEW.status IN ('accepted', 'rejected') THEN
    -- Notify the person who made the offer
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      NEW.user_id,
      'counter_offer_' || NEW.status,
      CASE
        WHEN NEW.status = 'accepted' THEN 'Counter Offer Accepted!'
        ELSE 'Counter Offer Declined'
      END,
      CASE
        WHEN NEW.status = 'accepted' THEN 'Your counter offer of TTD $' || NEW.amount_ttd || ' has been accepted!'
        ELSE 'Your counter offer of TTD $' || NEW.amount_ttd || ' was declined.'
      END,
      jsonb_build_object(
        'job_id', NEW.job_id,
        'counter_offer_id', NEW.id,
        'amount_ttd', NEW.amount_ttd,
        'status', NEW.status
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
