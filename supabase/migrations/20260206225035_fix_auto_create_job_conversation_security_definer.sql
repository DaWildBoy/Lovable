/*
  # Fix auto_create_job_conversation trigger permissions

  1. Problem
    - The auto_create_job_conversation trigger function runs as the calling user (not SECURITY DEFINER)
    - When a courier accepts a job, the trigger tries to create a conversation and add both the customer and courier as participants
    - RLS on conversation_participants blocks inserting the customer as a participant because the courier user cannot satisfy the policy conditions (circular dependency - the conversation has no participants yet, so SELECT on conversations fails)
    - This causes the entire job acceptance UPDATE to fail

  2. Fix
    - Alter the function to be SECURITY DEFINER so it bypasses RLS when creating conversations and participants
    - This is safe because the trigger only fires on trusted job status changes and creates conversations with the correct participants

  3. Also fix update_courier_earnings
    - Same issue: runs as the caller but needs to update the couriers table
*/

ALTER FUNCTION auto_create_job_conversation() SECURITY DEFINER;
ALTER FUNCTION update_courier_earnings() SECURITY DEFINER;
