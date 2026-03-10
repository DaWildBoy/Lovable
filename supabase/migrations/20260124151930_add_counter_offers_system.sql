/*
  # Add Counter Offers System for Fixed-Price Jobs

  1. New Tables
    - `counter_offers`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references jobs)
      - `courier_id` (uuid, references couriers)
      - `user_id` (uuid, references profiles - for easier querying)
      - `amount_ttd` (numeric) - counter offer amount
      - `message` (text) - optional message from courier
      - `status` (text) - 'pending', 'accepted', 'rejected', 'withdrawn'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `counter_offers` table
    - Couriers can create their own counter offers
    - Couriers can view their own counter offers
    - Job owners (customers/businesses) can view counter offers for their jobs
    - Only job owners can accept/reject counter offers

  3. Purpose
    - Allows couriers to submit counter offers on fixed-price jobs
    - Different from bids - counter offers don't change job status
    - Job remains available to others until customer accepts a counter offer
*/

-- Create counter_offers table
CREATE TABLE IF NOT EXISTS counter_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount_ttd numeric NOT NULL CHECK (amount_ttd > 0),
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_counter_offers_job_id ON counter_offers(job_id);
CREATE INDEX IF NOT EXISTS idx_counter_offers_courier_id ON counter_offers(courier_id);
CREATE INDEX IF NOT EXISTS idx_counter_offers_status ON counter_offers(status);

-- Enable RLS
ALTER TABLE counter_offers ENABLE ROW LEVEL SECURITY;

-- Couriers can create counter offers for their own account
CREATE POLICY "Couriers can create counter offers"
  ON counter_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Couriers can view their own counter offers
CREATE POLICY "Couriers can view own counter offers"
  ON counter_offers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Job owners can view counter offers for their jobs
CREATE POLICY "Job owners can view counter offers"
  ON counter_offers
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = counter_offers.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Job owners can update counter offers (accept/reject)
CREATE POLICY "Job owners can update counter offers"
  ON counter_offers
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = counter_offers.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = counter_offers.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Couriers can update their own counter offers (withdraw)
CREATE POLICY "Couriers can update own counter offers"
  ON counter_offers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to notify customer when counter offer is received
CREATE OR REPLACE FUNCTION notify_counter_offer_received()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    j.customer_user_id,
    'counter_offer_received',
    'New Counter Offer Received',
    'A courier has submitted a counter offer of TTD $' || NEW.amount_ttd || ' for your job.',
    jsonb_build_object(
      'job_id', NEW.job_id,
      'counter_offer_id', NEW.id,
      'amount_ttd', NEW.amount_ttd
    )
  FROM jobs j
  WHERE j.id = NEW.job_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for counter offer notifications
DROP TRIGGER IF EXISTS trigger_counter_offer_received ON counter_offers;
CREATE TRIGGER trigger_counter_offer_received
  AFTER INSERT ON counter_offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_counter_offer_received();

-- Function to notify courier when counter offer is accepted
CREATE OR REPLACE FUNCTION notify_counter_offer_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status AND NEW.status IN ('accepted', 'rejected') THEN
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

-- Create trigger for counter offer status notifications
DROP TRIGGER IF EXISTS trigger_counter_offer_status ON counter_offers;
CREATE TRIGGER trigger_counter_offer_status
  AFTER UPDATE ON counter_offers
  FOR EACH ROW
  EXECUTE FUNCTION notify_counter_offer_status();