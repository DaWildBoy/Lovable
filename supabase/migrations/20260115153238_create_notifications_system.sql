/*
  # Create Notifications System

  ## Overview
  Creates a comprehensive notification system for the platform to track and deliver
  in-app, email, and push notifications to users.

  ## New Tables

  ### notifications
    - `id` (uuid, primary key)
    - `user_id` (uuid, foreign key to auth.users) - Recipient of notification
    - `type` (text) - Type of notification: job_posted, bid_received, job_assigned, job_completed, etc.
    - `title` (text) - Notification title
    - `message` (text) - Notification message content
    - `data` (jsonb) - Additional structured data (job_id, bid_id, etc.)
    - `read` (boolean) - Whether notification has been read
    - `read_at` (timestamptz) - When notification was read
    - `email_sent` (boolean) - Whether email notification was sent
    - `email_sent_at` (timestamptz) - When email was sent
    - `push_sent` (boolean) - Whether push notification was sent
    - `push_sent_at` (timestamptz) - When push notification was sent
    - `created_at` (timestamptz) - When notification was created

  ## Security
    - Enable RLS
    - Users can only view their own notifications
    - System can insert notifications for any user
    - Users can mark their own notifications as read

  ## Indexes
    - Index on user_id for fast lookup
    - Index on read status for filtering
    - Index on created_at for sorting
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  data jsonb DEFAULT '{}'::jsonb,
  read boolean DEFAULT false,
  read_at timestamptz,
  email_sent boolean DEFAULT false,
  email_sent_at timestamptz,
  push_sent boolean DEFAULT false,
  push_sent_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- System can insert notifications (for edge functions)
CREATE POLICY "Service role can insert notifications"
  ON notifications
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read, user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- Create function to automatically send notifications when jobs are posted
CREATE OR REPLACE FUNCTION notify_job_posted()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert notification for the customer who posted the job
  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    NEW.customer_user_id,
    'job_posted',
    'Job Posted Successfully!',
    'Your delivery job is now live. Truckers can view and ' || 
    CASE WHEN NEW.pricing_type = 'bid' THEN 'bid on' ELSE 'accept' END || ' your job.',
    jsonb_build_object('job_id', NEW.id, 'pricing_type', NEW.pricing_type)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for job posted notifications
DROP TRIGGER IF EXISTS trigger_notify_job_posted ON jobs;
CREATE TRIGGER trigger_notify_job_posted
  AFTER INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_job_posted();

-- Create function to notify when bids are received
CREATE OR REPLACE FUNCTION notify_bid_received()
RETURNS TRIGGER AS $$
DECLARE
  job_customer_id uuid;
BEGIN
  -- Get the customer who posted the job
  SELECT customer_user_id INTO job_customer_id
  FROM jobs
  WHERE id = NEW.job_id;
  
  -- Insert notification for the customer
  IF job_customer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      job_customer_id,
      'bid_received',
      'New Bid Received!',
      'A trucker has placed a bid of TTD $' || NEW.bid_amount_ttd || ' on your delivery job.',
      jsonb_build_object('job_id', NEW.job_id, 'bid_id', NEW.id, 'bid_amount', NEW.bid_amount_ttd)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for bid received notifications
DROP TRIGGER IF EXISTS trigger_notify_bid_received ON bids;
CREATE TRIGGER trigger_notify_bid_received
  AFTER INSERT ON bids
  FOR EACH ROW
  EXECUTE FUNCTION notify_bid_received();

-- Create function to notify when job is completed
CREATE OR REPLACE FUNCTION notify_job_completed()
RETURNS TRIGGER AS $$
DECLARE
  job_customer_id uuid;
  job_courier_id uuid;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT customer_user_id, assigned_courier_id INTO job_customer_id, job_courier_id
    FROM jobs
    WHERE id = NEW.id;
    
    -- Notify customer
    IF job_customer_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        job_customer_id,
        'job_completed',
        'Delivery Completed!',
        'Your delivery has been completed successfully.',
        jsonb_build_object('job_id', NEW.id)
      );
    END IF;
    
    -- Notify courier
    IF job_courier_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        job_courier_id,
        'job_completed',
        'Job Completed!',
        'You have successfully completed a delivery job.',
        jsonb_build_object('job_id', NEW.id)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for job completed notifications
DROP TRIGGER IF EXISTS trigger_notify_job_completed ON jobs;
CREATE TRIGGER trigger_notify_job_completed
  AFTER UPDATE ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION notify_job_completed();