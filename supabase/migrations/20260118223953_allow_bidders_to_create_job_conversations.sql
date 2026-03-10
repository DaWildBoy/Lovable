/*
  # Allow Bidders to Create Job Conversations

  1. Updates
    - Modifies the job conversation creation policy to allow bidders (couriers who have placed bids) to create conversations
    - This enables customers to message bidders before accepting a bid
  
  2. Security
    - Customers can create conversations for their own jobs
    - Couriers can create conversations for jobs they've bid on or are assigned to
    - Maintains existing security restrictions
*/

DROP POLICY IF EXISTS "Users can create job conversations" ON conversations;

CREATE POLICY "Users can create job conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'job'
    AND (
      job_id IN (
        SELECT id FROM jobs
        WHERE customer_user_id = auth.uid()
      )
      OR
      job_id IN (
        SELECT job_id FROM bids
        WHERE courier_id IN (
          SELECT id FROM couriers WHERE user_id = auth.uid()
        )
      )
      OR
      job_id IN (
        SELECT id FROM jobs
        WHERE assigned_courier_id IN (
          SELECT id FROM couriers WHERE user_id = auth.uid()
        )
      )
    )
  );
