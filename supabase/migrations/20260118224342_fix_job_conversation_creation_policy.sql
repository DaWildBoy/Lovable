/*
  # Fix Job Conversation Creation Policy

  1. Updates
    - Simplifies the job conversation creation policy
    - Allows customers to create conversations for their jobs
    - Allows couriers to create conversations for jobs they've bid on or are assigned to
    - Removes overly restrictive checks that were preventing valid conversations
  
  2. Security
    - Customers can only create conversations for jobs they own
    - Couriers can only create conversations for jobs they're involved with
    - Maintains proper access control
*/

DROP POLICY IF EXISTS "Users can create job conversations" ON conversations;

CREATE POLICY "Users can create job conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'job'
    AND (
      EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.id = job_id
        AND jobs.customer_user_id = auth.uid()
      )
      OR
      EXISTS (
        SELECT 1 FROM bids
        WHERE bids.job_id = conversations.job_id
        AND bids.courier_id IN (
          SELECT id FROM couriers WHERE user_id = auth.uid()
        )
      )
      OR
      EXISTS (
        SELECT 1 FROM jobs
        WHERE jobs.id = job_id
        AND jobs.assigned_courier_id IN (
          SELECT id FROM couriers WHERE user_id = auth.uid()
        )
      )
    )
  );
