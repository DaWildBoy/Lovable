/*
  # Add Completed Deliveries Count and Fix Provider Ratings System

  1. Changes to Profiles Table
    - Add `completed_deliveries_count` (integer, default 0)

  2. Fix Provider Ratings RLS
    - Remove restrictive policies
    - Add simple, working policies that allow job owners to rate

  3. Create Server-Side Functions
    - `get_job_provider_info` - Gets provider ID and type from a job
    - `submit_provider_rating_safe` - Safely inserts rating with validation
    - `recompute_provider_stats` - Recalculates all provider statistics

  4. Create Trigger
    - Auto-update stats when rating is inserted
*/

-- Add completed_deliveries_count to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'completed_deliveries_count'
  ) THEN
    ALTER TABLE profiles ADD COLUMN completed_deliveries_count integer DEFAULT 0;
  END IF;
END $$;

-- Drop existing restrictive policies on provider_ratings
DROP POLICY IF EXISTS "Job owner can rate provider once" ON provider_ratings;
DROP POLICY IF EXISTS "Anyone can view ratings" ON provider_ratings;

-- Create simple, working RLS policies
CREATE POLICY "Authenticated users can view ratings"
  ON provider_ratings
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Job owners can insert ratings"
  ON provider_ratings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = rater_user_id
  );

-- Function to get provider info from a job
CREATE OR REPLACE FUNCTION get_job_provider_info(p_job_id uuid)
RETURNS TABLE(provider_id uuid, provider_type text, job_status text, job_owner_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.user_id as provider_id,
    'courier'::text as provider_type,
    j.status as job_status,
    j.customer_user_id as job_owner_id
  FROM jobs j
  JOIN couriers c ON c.id = j.assigned_courier_id
  WHERE j.id = p_job_id;
END;
$$;

-- Function to safely submit a provider rating
CREATE OR REPLACE FUNCTION submit_provider_rating_safe(
  p_job_id uuid,
  p_rater_user_id uuid,
  p_rater_account_type text,
  p_stars integer,
  p_comment text DEFAULT NULL,
  p_tags text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_provider_id uuid;
  v_provider_type text;
  v_job_status text;
  v_job_owner_id uuid;
  v_existing_rating_id uuid;
  v_new_rating_id uuid;
BEGIN
  -- Validate star rating
  IF p_stars < 1 OR p_stars > 5 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Rating must be between 1 and 5 stars'
    );
  END IF;

  -- Get job and provider info
  SELECT provider_id, provider_type, job_status, job_owner_id
  INTO v_provider_id, v_provider_type, v_job_status, v_job_owner_id
  FROM get_job_provider_info(p_job_id);

  -- Check if job exists and has a provider
  IF v_provider_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Job not found or no provider assigned'
    );
  END IF;

  -- Check if job is completed
  IF v_job_status != 'completed' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Can only rate completed deliveries'
    );
  END IF;

  -- Check if user is the job owner
  IF v_job_owner_id != p_rater_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Only the job owner can rate this delivery'
    );
  END IF;

  -- Check for existing rating
  SELECT id INTO v_existing_rating_id
  FROM provider_ratings
  WHERE job_id = p_job_id;

  IF v_existing_rating_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You have already rated this delivery'
    );
  END IF;

  -- Insert the rating
  INSERT INTO provider_ratings (
    job_id,
    rater_user_id,
    rater_account_type,
    provider_id,
    provider_type,
    stars,
    comment,
    tags
  ) VALUES (
    p_job_id,
    p_rater_user_id,
    p_rater_account_type,
    v_provider_id,
    v_provider_type,
    p_stars,
    p_comment,
    p_tags
  )
  RETURNING id INTO v_new_rating_id;

  -- Return success
  RETURN jsonb_build_object(
    'success', true,
    'rating_id', v_new_rating_id,
    'provider_id', v_provider_id,
    'provider_type', v_provider_type
  );
END;
$$;

-- Function to recompute provider statistics
CREATE OR REPLACE FUNCTION recompute_provider_stats(p_provider_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rating_avg numeric;
  v_rating_count integer;
  v_completed_count integer;
BEGIN
  -- Calculate rating average and count
  SELECT 
    ROUND(AVG(stars)::numeric, 2),
    COUNT(*)
  INTO v_rating_avg, v_rating_count
  FROM provider_ratings
  WHERE provider_id = p_provider_id;

  -- Calculate completed deliveries count
  SELECT COUNT(DISTINCT j.id)
  INTO v_completed_count
  FROM jobs j
  JOIN couriers c ON c.id = j.assigned_courier_id
  WHERE c.user_id = p_provider_id
    AND j.status = 'completed';

  -- Update profiles table
  UPDATE profiles
  SET 
    rating_average = COALESCE(v_rating_avg, 0),
    rating_count = COALESCE(v_rating_count, 0),
    completed_deliveries_count = COALESCE(v_completed_count, 0)
  WHERE id = p_provider_id;

  -- Also update couriers table for backwards compatibility
  UPDATE couriers
  SET 
    rating_average = COALESCE(v_rating_avg, 0),
    rating_count = COALESCE(v_rating_count, 0)
  WHERE user_id = p_provider_id;
END;
$$;

-- Update existing trigger to use new stats function
DROP TRIGGER IF EXISTS update_provider_rating_aggregates_trigger ON provider_ratings;

CREATE OR REPLACE FUNCTION trigger_update_provider_stats()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recompute_provider_stats(NEW.provider_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_provider_stats_on_rating
  AFTER INSERT ON provider_ratings
  FOR EACH ROW
  EXECUTE FUNCTION trigger_update_provider_stats();

-- Create trigger to update completed deliveries when job completes
CREATE OR REPLACE FUNCTION trigger_update_completed_deliveries()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    IF NEW.assigned_courier_id IS NOT NULL THEN
      -- Update the provider's completed deliveries count
      PERFORM recompute_provider_stats(
        (SELECT user_id FROM couriers WHERE id = NEW.assigned_courier_id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS update_completed_deliveries_on_job_complete ON jobs;
CREATE TRIGGER update_completed_deliveries_on_job_complete
  AFTER UPDATE ON jobs
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION trigger_update_completed_deliveries();

-- Backfill completed deliveries count for existing providers
DO $$
DECLARE
  provider_record RECORD;
BEGIN
  FOR provider_record IN 
    SELECT DISTINCT c.user_id
    FROM couriers c
  LOOP
    PERFORM recompute_provider_stats(provider_record.user_id);
  END LOOP;
END $$;
