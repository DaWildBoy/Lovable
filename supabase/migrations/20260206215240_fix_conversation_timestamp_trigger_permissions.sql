/*
  # Fix Conversation Timestamp Trigger Permissions

  ## Problem
  The `update_conversation_timestamp` trigger fires after every message INSERT
  to update the conversation's `last_message_at` field. However, the only
  UPDATE policy on `conversations` is admin-only. When a regular user sends a
  message, the trigger fails due to RLS, which rolls back the entire message
  INSERT -- causing messages to silently disappear.

  ## Solution
  Recreate the `update_conversation_timestamp` function with SECURITY DEFINER
  so it runs with elevated privileges and can update the conversation timestamp
  regardless of the caller's role.

  ## Functions Modified
  - `update_conversation_timestamp()` - Changed to SECURITY DEFINER
*/

CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;
