/*
  # Fix Conversation Participants SELECT Policy

  1. Updates
    - Updates the conversation_participants SELECT policy to allow viewing all participants in conversations a user is part of
    - This enables finding existing conversations by checking participant lists
    - Previously users could only see their own participant record, breaking conversation searches
  
  2. Security
    - Users can view all participants in conversations they're members of
    - Admins can view all participant records
    - Non-participants cannot see conversation participants
*/

DROP POLICY IF EXISTS "Users can view their participant records" ON conversation_participants;

CREATE POLICY "Users can view participant records in their conversations"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp2
      WHERE cp2.conversation_id = conversation_participants.conversation_id
      AND cp2.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );
