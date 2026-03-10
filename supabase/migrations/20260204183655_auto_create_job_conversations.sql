/*
  # Auto-Create Job Conversations and Message Notifications

  ## Overview
  This migration adds automatic conversation creation when jobs are accepted
  and sends notifications when messages are sent.

  ## Changes
  1. **Auto-create conversations**: When a job is assigned to a courier or company,
     automatically create a conversation between the customer and the service provider
  2. **Message notifications**: When a new message is sent, notify all other participants
  3. **Prevent messaging on completed jobs**: Block new messages on completed jobs via RLS

  ## Tables Modified
  - conversations: No schema changes
  - messages: Added RLS policy to prevent messaging on completed jobs
  - notifications: Will receive new entries via trigger

  ## Functions Created
  1. `auto_create_job_conversation()`: Creates conversation when job is assigned
  2. `notify_message_participants()`: Notifies participants of new messages

  ## Triggers Created
  1. `trigger_auto_create_job_conversation`: Fires when job status becomes 'assigned'
  2. `trigger_notify_message_participants`: Fires when new message is inserted
*/

-- Function to automatically create a conversation when a job is assigned
CREATE OR REPLACE FUNCTION auto_create_job_conversation()
RETURNS TRIGGER AS $$
DECLARE
  v_conversation_id uuid;
  v_customer_id uuid;
  v_service_provider_id uuid;
  v_conversation_exists boolean;
BEGIN
  -- Only proceed if job is being assigned (status changed to 'assigned')
  IF NEW.status = 'assigned' AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN

    -- Get the customer ID
    v_customer_id := NEW.customer_user_id;

    -- Determine the service provider ID (could be courier or haulage company)
    IF NEW.assigned_company_id IS NOT NULL THEN
      v_service_provider_id := NEW.assigned_company_id;
    ELSIF NEW.assigned_courier_id IS NOT NULL THEN
      -- Get the user_id from the courier
      SELECT user_id INTO v_service_provider_id
      FROM couriers
      WHERE id = NEW.assigned_courier_id;
    ELSE
      -- No service provider assigned yet, skip
      RETURN NEW;
    END IF;

    -- Check if conversation already exists for this job
    SELECT EXISTS(
      SELECT 1 FROM conversations WHERE job_id = NEW.id
    ) INTO v_conversation_exists;

    -- Only create if conversation doesn't exist
    IF NOT v_conversation_exists THEN
      -- Create the conversation
      INSERT INTO conversations (type, job_id, status)
      VALUES ('job', NEW.id, 'active')
      RETURNING id INTO v_conversation_id;

      -- Add customer as participant
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conversation_id, v_customer_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;

      -- Add service provider as participant
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conversation_id, v_service_provider_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;

      RAISE NOTICE 'Created conversation % for job % between customer % and provider %',
        v_conversation_id, NEW.id, v_customer_id, v_service_provider_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-create conversation when job is assigned
DROP TRIGGER IF EXISTS trigger_auto_create_job_conversation ON jobs;
CREATE TRIGGER trigger_auto_create_job_conversation
  AFTER INSERT OR UPDATE OF status, assigned_courier_id, assigned_company_id ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_job_conversation();

-- Function to notify all conversation participants when a new message is sent
CREATE OR REPLACE FUNCTION notify_message_participants()
RETURNS TRIGGER AS $$
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
      job_id,
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
      v_job_id,
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to notify participants when a new message is sent
DROP TRIGGER IF EXISTS trigger_notify_message_participants ON messages;
CREATE TRIGGER trigger_notify_message_participants
  AFTER INSERT ON messages
  FOR EACH ROW
  WHEN (NEW.sender_type = 'user')
  EXECUTE FUNCTION notify_message_participants();

-- Add RLS policy to prevent sending messages on completed jobs
CREATE POLICY "Cannot send messages on completed jobs"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    NOT EXISTS (
      SELECT 1
      FROM conversations c
      JOIN jobs j ON c.job_id = j.id
      WHERE c.id = conversation_id
        AND c.type = 'job'
        AND j.status = 'completed'
    )
  );