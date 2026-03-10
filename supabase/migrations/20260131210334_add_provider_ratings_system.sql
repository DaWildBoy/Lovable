/*
  # Provider Ratings System

  1. New Tables
    - `provider_ratings`
      - `id` (uuid, primary key)
      - `job_id` (uuid, unique, references jobs)
      - `rater_user_id` (uuid, references profiles)
      - `rater_account_type` (text: 'customer' or 'retail')
      - `provider_id` (uuid, references profiles - the courier being rated)
      - `provider_type` (text: 'courier' or 'trucking_company')
      - `stars` (integer, 1-5)
      - `comment` (text, nullable)
      - `tags` (text array, nullable)
      - `created_at` (timestamp)

  2. Profile Updates
    - Add `rating_average` (numeric, nullable)
    - Add `rating_count` (integer, default 0)

  3. Security
    - Enable RLS on provider_ratings table
    - Job owner can insert rating for their completed job (one per job)
    - Everyone can read ratings
    - No updates or deletes allowed

  4. Functions
    - Trigger to update provider profile rating aggregates on new rating
*/

-- Add rating fields to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rating_average'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rating_average numeric(3,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'rating_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN rating_count integer DEFAULT 0;
  END IF;
END $$;

-- Create provider_ratings table
CREATE TABLE IF NOT EXISTS provider_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid UNIQUE NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  rater_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rater_account_type text NOT NULL CHECK (rater_account_type IN ('customer', 'retail', 'business')),
  provider_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider_type text NOT NULL CHECK (provider_type IN ('courier', 'trucking_company')),
  stars integer NOT NULL CHECK (stars >= 1 AND stars <= 5),
  comment text,
  tags text[],
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE provider_ratings ENABLE ROW LEVEL SECURITY;

-- Job owner can insert one rating for their completed job
CREATE POLICY "Job owner can rate provider once"
  ON provider_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = rater_user_id
    AND EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = job_id
      AND jobs.customer_user_id = auth.uid()
      AND jobs.status = 'completed'
    )
  );

-- Everyone can read ratings
CREATE POLICY "Anyone can view ratings"
  ON provider_ratings
  FOR SELECT
  TO authenticated
  USING (true);

-- Create function to update provider rating aggregates
CREATE OR REPLACE FUNCTION update_provider_rating_aggregates()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate new average and count for the provider
  UPDATE profiles
  SET 
    rating_average = (
      SELECT ROUND(AVG(stars)::numeric, 2)
      FROM provider_ratings
      WHERE provider_id = NEW.provider_id
    ),
    rating_count = (
      SELECT COUNT(*)
      FROM provider_ratings
      WHERE provider_id = NEW.provider_id
    )
  WHERE id = NEW.provider_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update aggregates on new rating
DROP TRIGGER IF EXISTS update_provider_rating_aggregates_trigger ON provider_ratings;
CREATE TRIGGER update_provider_rating_aggregates_trigger
  AFTER INSERT ON provider_ratings
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_rating_aggregates();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_provider_ratings_job_id ON provider_ratings(job_id);
CREATE INDEX IF NOT EXISTS idx_provider_ratings_provider_id ON provider_ratings(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_ratings_rater_user_id ON provider_ratings(rater_user_id);
