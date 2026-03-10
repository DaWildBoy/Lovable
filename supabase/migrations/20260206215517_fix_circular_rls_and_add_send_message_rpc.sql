/*
  # Fix Circular RLS Dependencies and Add Send Message RPC

  ## Problem
  The SELECT policies on `conversations` and `conversation_participants` reference
  each other, creating a circular RLS dependency that causes infinite recursion
  errors when trying to INSERT messages (because the INSERT policy checks
  conversation_participants, which checks conversations, which checks
  conversation_participants again).

  ## Solution
  1. Replace the conversation_participants SELECT policy to only self-reference
     (no cross-table dependency on conversations)
  2. Replace the conversations SELECT policy to reference conversation_participants
     without circular dependency
  3. Create a SECURITY DEFINER `send_message` RPC that bypasses RLS with proper
     authorization checks

  ## Policies Modified
  - `conversation_participants` SELECT: Simplified to self-reference only
  - `conversations` SELECT: Simplified to avoid circular dependency

  ## Functions Created
  - `send_message(p_conversation_id, p_content, p_attachment_url, p_attachment_type, p_attachment_metadata)` - SECURITY DEFINER RPC
*/

DROP POLICY IF EXISTS "Users can view participants in accessible conversations" ON conversation_participants;

CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR conversation_id IN (
      SELECT cp2.conversation_id 
      FROM conversation_participants cp2 
      WHERE cp2.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view conversations they participate in" ON conversations;
DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;

CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT cp.conversation_id 
      FROM conversation_participants cp 
      WHERE cp.user_id = auth.uid()
    )
    OR assigned_admin_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

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

  INSERT INTO messages (conversation_id, sender_id, sender_type, content, attachment_metadata)
  VALUES (p_conversation_id, v_caller_id, 'user', p_content, COALESCE(p_attachment_metadata, '{}'::jsonb))
  RETURNING id, created_at INTO v_message_id, v_created_at;

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
