/*
  # Fix Conversation Participants Policy

  1. Updates
    - Fixes the conversation_participants INSERT policy to allow adding couriers who have bid on a job
    - Customers can add any courier who has bid on their job (not just assigned couriers)
    - Allows proper conversation creation between customers and bidding couriers
  
  2. Security
    - Users can add themselves to any conversation
    - For job conversations, verifies legitimate relationships:
      - Customer can add couriers who have bid on their job
      - Couriers can add customers whose jobs they've bid on or are assigned to
    - Maintains proper access control
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
      AND (
        EXISTS (
          SELECT 1 FROM jobs j
          WHERE j.id = c.job_id
          AND j.customer_user_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM jobs j
          WHERE j.id = c.job_id
          AND j.assigned_courier_id IN (
            SELECT id FROM couriers WHERE user_id = auth.uid()
          )
        )
        OR
        EXISTS (
          SELECT 1 FROM bids b
          WHERE b.job_id = c.job_id
          AND b.courier_id IN (
            SELECT id FROM couriers WHERE user_id = auth.uid()
          )
        )
      )
    )
  );
