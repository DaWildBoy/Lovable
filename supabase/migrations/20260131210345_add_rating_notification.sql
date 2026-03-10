/*
  # Add Notification for New Ratings

  1. Function
    - Create function to notify provider when they receive a new rating

  2. Trigger
    - Send notification to provider after new rating is inserted
*/

-- Create function to notify provider of new rating
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
    related_job_id,
    created_at
  ) VALUES (
    NEW.provider_id,
    'rating_received',
    'New Rating Received',
    'You received a ' || NEW.stars || '★ rating from ' || COALESCE(v_rater_name, 'a customer'),
    NEW.job_id,
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS notify_provider_new_rating_trigger ON provider_ratings;
CREATE TRIGGER notify_provider_new_rating_trigger
  AFTER INSERT ON provider_ratings
  FOR EACH ROW
  EXECUTE FUNCTION notify_provider_new_rating();
