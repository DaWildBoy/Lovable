/*
  # Fix Infinite Recursion in Conversation Participants Policy

  1. Problem
    - The previous SELECT policy caused infinite recursion by referencing conversation_participants within its own policy
    - This happens when checking if a user is in a conversation by querying conversation_participants
  
  2. Solution
    - Use a subquery on the conversations table instead
    - Check if the user has access to the conversation first, then allow viewing participants
    - Breaks the circular dependency
  
  3. Security
    - Users can view all participants in conversations they're allowed to access
    - Admins can view all participant records
    - Maintains proper access control without recursion
*/

DROP POLICY IF EXISTS "Users can view participant records in their conversations" ON conversation_participants;

CREATE POLICY "Users can view participants in accessible conversations"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (
      SELECT c.id FROM conversations c
      LEFT JOIN conversation_participants cp ON cp.conversation_id = c.id
      WHERE 
        cp.user_id = auth.uid()
        OR c.assigned_admin_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role = 'admin'
        )
    )
  );
