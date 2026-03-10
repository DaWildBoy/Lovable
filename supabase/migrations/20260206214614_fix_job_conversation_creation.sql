/*
  # Fix Job Conversation Creation

  ## Problem
  - The auto-create conversation trigger on jobs table was missing
  - Client-side conversation creation was blocked by RLS circular dependencies
    (conversation_participants INSERT policy queries conversations, but conversations
    SELECT policy requires being a participant first)

  ## Solution
  1. Create a SECURITY DEFINER RPC function `get_or_create_job_conversation` that:
     - Checks if a conversation already exists for the job
     - If not, creates one and adds both participants
     - Returns the conversation ID
     - Validates that the caller is either the customer or assigned courier
  2. Re-create the auto-create conversation trigger on the jobs table

  ## Functions Created
  - `get_or_create_job_conversation(p_job_id uuid)` - SECURITY DEFINER RPC

  ## Triggers Re-created
  - `trigger_auto_create_job_conversation` on jobs table
*/

-- Create SECURITY DEFINER function for getting/creating job conversations
CREATE OR REPLACE FUNCTION get_or_create_job_conversation(p_job_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conversation_id uuid;
  v_customer_id uuid;
  v_courier_user_id uuid;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT j.customer_user_id, c.user_id
  INTO v_customer_id, v_courier_user_id
  FROM jobs j
  LEFT JOIN couriers c ON c.id = j.assigned_courier_id
  WHERE j.id = p_job_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_caller_id != v_customer_id AND v_caller_id != v_courier_user_id THEN
    RAISE EXCEPTION 'Not authorized to message on this job';
  END IF;

  SELECT conv.id INTO v_conversation_id
  FROM conversations conv
  WHERE conv.type = 'job' AND conv.job_id = p_job_id
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM conversation_participants
      WHERE conversation_id = v_conversation_id AND user_id = v_caller_id
    ) THEN
      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conversation_id, v_caller_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
    RETURN v_conversation_id;
  END IF;

  INSERT INTO conversations (type, job_id, status)
  VALUES ('job', p_job_id, 'active')
  RETURNING id INTO v_conversation_id;

  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_customer_id)
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  IF v_courier_user_id IS NOT NULL AND v_courier_user_id != v_customer_id THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_courier_user_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$$;

-- Re-create the auto-create conversation trigger function
CREATE OR REPLACE FUNCTION auto_create_job_conversation()
RETURNS TRIGGER AS $$
DECLARE
  v_conversation_id uuid;
  v_customer_id uuid;
  v_service_provider_id uuid;
  v_conversation_exists boolean;
BEGIN
  IF NEW.status = 'assigned' AND (OLD.status IS NULL OR OLD.status != 'assigned') THEN
    v_customer_id := NEW.customer_user_id;

    IF NEW.assigned_company_id IS NOT NULL THEN
      v_service_provider_id := NEW.assigned_company_id;
    ELSIF NEW.assigned_courier_id IS NOT NULL THEN
      SELECT user_id INTO v_service_provider_id
      FROM couriers
      WHERE id = NEW.assigned_courier_id;
    ELSE
      RETURN NEW;
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM conversations WHERE job_id = NEW.id
    ) INTO v_conversation_exists;

    IF NOT v_conversation_exists THEN
      INSERT INTO conversations (type, job_id, status)
      VALUES ('job', NEW.id, 'active')
      RETURNING id INTO v_conversation_id;

      INSERT INTO conversation_participants (conversation_id, user_id)
      VALUES (v_conversation_id, v_customer_id)
      ON CONFLICT (conversation_id, user_id) DO NOTHING;

      IF v_service_provider_id IS NOT NULL THEN
        INSERT INTO conversation_participants (conversation_id, user_id)
        VALUES (v_conversation_id, v_service_provider_id)
        ON CONFLICT (conversation_id, user_id) DO NOTHING;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_create_job_conversation ON jobs;
CREATE TRIGGER trigger_auto_create_job_conversation
  AFTER INSERT OR UPDATE OF status, assigned_courier_id, assigned_company_id ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_job_conversation();
