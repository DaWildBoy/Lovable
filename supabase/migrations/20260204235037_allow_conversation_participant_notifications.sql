/*
  # Allow conversation participants to create notifications
  
  1. Changes
    - Add INSERT policy for notifications that allows users to create notifications 
      for other participants in the same conversation
    - This enables the message notification trigger to work properly
    
  2. Security
    - Users can only create notifications for users in conversations they are part of
    - Prevents spam by requiring shared conversation membership
*/

CREATE POLICY "Conversation participants can create notifications"
  ON notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow creating notifications for users in the same conversation
    EXISTS (
      SELECT 1
      FROM conversation_participants cp1
      JOIN conversation_participants cp2 
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = auth.uid()
        AND cp2.user_id = notifications.user_id
        AND cp1.conversation_id = (notifications.data->>'conversation_id')::uuid
    )
  );
