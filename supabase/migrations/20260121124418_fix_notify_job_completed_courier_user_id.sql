/*
  # Fix Job Completion Notification Trigger

  1. Changes
    - Fix notify_job_completed function to correctly look up courier's user_id
    - The assigned_courier_id is a reference to couriers.id, not auth.users.id
    - Need to join couriers table to get the user_id for notifications

  2. Notes
    - This fixes the foreign key constraint error when completing jobs
    - Notifications.user_id references auth.users(id) which is the same as profiles.id
*/

-- Drop and recreate the function with correct logic
CREATE OR REPLACE FUNCTION notify_job_completed()
RETURNS TRIGGER AS $$
DECLARE
  job_customer_id uuid;
  job_courier_user_id uuid;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get customer_user_id directly from the jobs table
    SELECT customer_user_id INTO job_customer_id
    FROM jobs
    WHERE id = NEW.id;
    
    -- Get courier's user_id by joining with couriers table
    SELECT couriers.user_id INTO job_courier_user_id
    FROM jobs
    JOIN couriers ON couriers.id = jobs.assigned_courier_id
    WHERE jobs.id = NEW.id;
    
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
    IF job_courier_user_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        job_courier_user_id,
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
