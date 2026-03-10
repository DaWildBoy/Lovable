/*
  # Fix Rating Notification Trigger

  1. Problem
    - The rating notification trigger was trying to insert into a non-existent `related_job_id` column
    - Notifications table uses `data` (jsonb) to store related information

  2. Solution
    - Update the trigger function to use the correct column structure
    - Store job_id in the data jsonb field
*/

-- Drop and recreate the notification trigger function with correct column usage
CREATE OR REPLACE FUNCTION notify_provider_new_rating()
RETURNS TRIGGER AS $$
DECLARE
  v_rater_name text;
  v_provider_name text;
BEGIN
  -- Get rater name
  SELECT full_name INTO v_rater_name
  FROM profiles
  WHERE id = NEW.rater_user_id;

  -- Get provider name
  SELECT full_name INTO v_provider_name
  FROM profiles
  WHERE id = NEW.provider_id;

  -- Insert notification for the provider
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    data,
    created_at
  ) VALUES (
    NEW.provider_id,
    'rating_received',
    'New Rating Received',
    'You received a ' || NEW.stars || '★ rating from ' || COALESCE(v_rater_name, 'a customer'),
    jsonb_build_object(
      'job_id', NEW.job_id,
      'rating_id', NEW.id,
      'stars', NEW.stars,
      'rater_name', v_rater_name
    ),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
