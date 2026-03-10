/*
  # Fix Messaging: Add Attachment Columns and Update send_message RPC

  1. Schema Changes
    - Add `attachment_url` (text, nullable) to `messages` table for storing attachment file URLs
    - Add `attachment_type` (text, nullable) to `messages` table for storing attachment type (image, video, audio, document, location)

  2. Function Updates
    - Update `send_message` RPC to include `attachment_url` and `attachment_type` in the INSERT statement
      so attachment data is persisted to the database

  3. Function Updates
    - Update `get_or_create_job_conversation` RPC to also allow haulage/retail business company
      users (via `assigned_company_id`) to create and participate in job conversations

  4. Important Notes
    - Existing messages without attachments will have NULL for both new columns
    - The send_message function remains SECURITY DEFINER to bypass RLS with proper auth checks
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'attachment_url'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN attachment_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'messages' AND column_name = 'attachment_type'
  ) THEN
    ALTER TABLE public.messages ADD COLUMN attachment_type text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION send_message(
  p_conversation_id uuid,
  p_content text,
  p_attachment_url text DEFAULT NULL,
  p_attachment_type text DEFAULT NULL,
  p_attachment_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_message_id uuid;
  v_created_at timestamptz;
  v_is_participant boolean;
  v_job_completed boolean;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = v_caller_id
  ) INTO v_is_participant;

  IF NOT v_is_participant THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM conversations c
    JOIN jobs j ON j.id = c.job_id
    WHERE c.id = p_conversation_id
      AND c.type = 'job'
      AND j.status IN ('completed', 'cancelled')
  ) INTO v_job_completed;

  IF v_job_completed THEN
    RAISE EXCEPTION 'Cannot send messages on completed jobs';
  END IF;

  INSERT INTO messages (conversation_id, sender_id, sender_type, content, attachment_url, attachment_type, attachment_metadata)
  VALUES (p_conversation_id, v_caller_id, 'user', p_content, p_attachment_url, p_attachment_type, COALESCE(p_attachment_metadata, '{}'::jsonb))
  RETURNING id, created_at INTO v_message_id, v_created_at;

  UPDATE conversations
  SET last_message_at = v_created_at
  WHERE id = p_conversation_id;

  RETURN jsonb_build_object(
    'id', v_message_id,
    'conversation_id', p_conversation_id,
    'sender_id', v_caller_id,
    'sender_type', 'user',
    'content', p_content,
    'attachment_url', p_attachment_url,
    'attachment_type', p_attachment_type,
    'attachment_metadata', COALESCE(p_attachment_metadata, '{}'::jsonb),
    'created_at', v_created_at,
    'is_deleted', false
  );
END;
$$;

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
  v_company_user_id uuid;
  v_caller_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT j.customer_user_id, c.user_id, j.assigned_company_id
  INTO v_customer_id, v_courier_user_id, v_company_user_id
  FROM jobs j
  LEFT JOIN couriers c ON c.id = j.assigned_courier_id
  WHERE j.id = p_job_id;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'Job not found';
  END IF;

  IF v_caller_id != v_customer_id
    AND (v_courier_user_id IS NULL OR v_caller_id != v_courier_user_id)
    AND (v_company_user_id IS NULL OR v_caller_id != v_company_user_id)
  THEN
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

  IF v_company_user_id IS NOT NULL
    AND v_company_user_id != v_customer_id
    AND (v_courier_user_id IS NULL OR v_company_user_id != v_courier_user_id)
  THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (v_conversation_id, v_company_user_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conversation_id;
END;
$$;