/*
  # Add Completed Deliveries Count to Couriers Table

  1. Changes
    - Add `completed_deliveries_count` to couriers table for consistency
    - Update `recompute_provider_stats` to also update couriers table

  2. Notes
    - This ensures courier profile displays are in sync with profiles table
    - Backfills existing data from profiles table
*/

-- Add completed_deliveries_count to couriers table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'couriers' AND column_name = 'completed_deliveries_count'
  ) THEN
    ALTER TABLE couriers ADD COLUMN completed_deliveries_count integer DEFAULT 0;
  END IF;
END $$;

-- Update the recompute function to include completed deliveries in couriers table
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
    rating_count = COALESCE(v_rating_count, 0),
    completed_deliveries_count = COALESCE(v_completed_count, 0)
  WHERE user_id = p_provider_id;
END;
$$;

-- Backfill completed_deliveries_count from profiles to couriers
UPDATE couriers c
SET completed_deliveries_count = COALESCE(p.completed_deliveries_count, 0)
FROM profiles p
WHERE c.user_id = p.id;