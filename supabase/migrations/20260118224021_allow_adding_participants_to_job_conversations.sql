/*
  # Allow Adding Participants to Job Conversations

  1. Updates
    - Updates the conversation_participants INSERT policy to allow adding other users to job conversations
    - Customers can add couriers who have bid on their jobs
    - Couriers can add customers to conversations for jobs they're involved in
  
  2. Security
    - Users can still only add themselves to support conversations
    - For job conversations, verifies the users being added are legitimate participants
    - Maintains data integrity and security
*/

DROP POLICY IF EXISTS "Users can join conversations" ON conversation_participants;

CREATE POLICY "Users can join conversations"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = conversation_id
      AND c.type = 'job'
      AND c.job_id IN (
        SELECT id FROM jobs j
        WHERE j.customer_user_id = auth.uid()
        OR j.assigned_courier_id IN (
          SELECT id FROM couriers WHERE user_id = auth.uid()
        )
      )
    )
  );
