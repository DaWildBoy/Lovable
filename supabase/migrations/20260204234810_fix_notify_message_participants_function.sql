/*
  # Fix notify_message_participants function
  
  1. Changes
    - Update notify_message_participants function to store job_id in the data JSONB column
    - Remove reference to non-existent job_id column
    
  2. Notes
    - The notifications table uses a JSONB data column for storing metadata
    - This fixes the "column job_id does not exist" error when sending messages
*/

CREATE OR REPLACE FUNCTION public.notify_message_participants()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_participant_id uuid;
  v_job_id uuid;
  v_sender_name text;
  v_conversation_type text;
BEGIN
  -- Get conversation details
  SELECT type, job_id INTO v_conversation_type, v_job_id
  FROM conversations
  WHERE id = NEW.conversation_id;

  -- Get sender name
  SELECT COALESCE(full_name, email) INTO v_sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Notify all participants except the sender
  FOR v_participant_id IN
    SELECT user_id
    FROM conversation_participants
    WHERE conversation_id = NEW.conversation_id
      AND user_id != NEW.sender_id
  LOOP
    -- Create notification for each participant
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data,
      read
    ) VALUES (
      v_participant_id,
      'message',
      'New Message',
      CASE
        WHEN v_conversation_type = 'job' THEN
          v_sender_name || ' sent you a message about a job'
        ELSE
          v_sender_name || ' sent you a message'
      END,
      jsonb_build_object(
        'job_id', v_job_id,
        'conversation_id', NEW.conversation_id,
        'message_id', NEW.id
      ),
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;
