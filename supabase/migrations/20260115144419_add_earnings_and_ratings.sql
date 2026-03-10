/*
  # Add Earnings Tracking and Rating System

  1. Changes to Couriers Table
    - Add `total_earnings_ttd` field to track lifetime earnings
    - Add `rating_average` field for average rating
    - Add `rating_count` field for total number of ratings

  2. New Tables
    - `ratings`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references jobs, unique)
      - `customer_user_id` (uuid, references profiles)
      - `courier_id` (uuid, references couriers)
      - `rating` (integer, 1-5)
      - `comment` (text, nullable)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on ratings table
    - Customers can create ratings for their completed jobs
    - Couriers can view their ratings
*/

-- Add earnings and rating fields to couriers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'total_earnings_ttd'
  ) THEN
    ALTER TABLE couriers ADD COLUMN total_earnings_ttd numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'rating_average'
  ) THEN
    ALTER TABLE couriers ADD COLUMN rating_average numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'rating_count'
  ) THEN
    ALTER TABLE couriers ADD COLUMN rating_count integer DEFAULT 0;
  END IF;
END $$;

-- Create ratings table
CREATE TABLE IF NOT EXISTS ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE UNIQUE,
  customer_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on ratings table
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

-- Customers can create ratings for their completed jobs
CREATE POLICY "Customers can rate their completed jobs"
  ON ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = customer_user_id
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_id
      AND jobs.customer_user_id = auth.uid()
      AND jobs.status = 'completed'
    )
  );

-- Customers can view ratings they've created
CREATE POLICY "Customers can view their own ratings"
  ON ratings
  FOR SELECT
  TO authenticated
  USING (auth.uid() = customer_user_id);

-- Couriers can view ratings about them
CREATE POLICY "Couriers can view their ratings"
  ON ratings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM couriers
      WHERE couriers.id = ratings.courier_id
      AND couriers.user_id = auth.uid()
    )
  );

-- Create function to update courier stats when a rating is added
CREATE OR REPLACE FUNCTION update_courier_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE couriers
  SET
    rating_average = (
      SELECT AVG(rating)::numeric
      FROM ratings
      WHERE courier_id = NEW.courier_id
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM ratings
      WHERE courier_id = NEW.courier_id
    )
  WHERE id = NEW.courier_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update courier rating stats
DROP TRIGGER IF EXISTS trigger_update_courier_rating ON ratings;
CREATE TRIGGER trigger_update_courier_rating
  AFTER INSERT ON ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_courier_rating();

-- Create function to update courier earnings when job is completed
CREATE OR REPLACE FUNCTION update_courier_earnings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.assigned_courier_id IS NOT NULL THEN
    UPDATE couriers
    SET total_earnings_ttd = COALESCE(total_earnings_ttd, 0) + COALESCE(NEW.customer_offer_ttd, 0)
    WHERE id = NEW.assigned_courier_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update courier earnings
DROP TRIGGER IF EXISTS trigger_update_courier_earnings ON jobs;
CREATE TRIGGER trigger_update_courier_earnings
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_courier_earnings();