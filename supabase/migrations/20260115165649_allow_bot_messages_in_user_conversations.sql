/*
  # Allow Bot Messages in User Conversations

  ## Changes
  Adds a policy to allow users to insert bot messages into conversations
  where they are participants. This enables the welcome message when
  creating support conversations.

  ## Security
  Users can only insert bot messages (sender_type='bot') into conversations
  where they are already participants, preventing abuse.
*/

-- Allow users to insert bot messages into their own conversations
CREATE POLICY "Users can add bot messages to their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_type = 'bot'
    AND sender_id IS NULL
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );