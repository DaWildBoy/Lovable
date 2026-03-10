/*
  # Break Circular Dependency Between Profiles and Conversation Participants

  1. Changes
    - Simplify profiles SELECT policy to not use conversation_participants
    - Update can_view_conversation_participants to not query profiles
    - Use separate admin check that doesn't cause recursion

  2. Security
    - Users can view their own profile
    - Users can view profiles when they interact through bids (direct table, no recursion)
    - Maintains security without circular dependencies
*/

-- Drop problematic policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view conversation participants profiles" ON profiles;

-- Create simple, non-recursive profile policies
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow viewing courier profiles when they bid on your job
CREATE POLICY "Customers can view courier profiles who bid"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM bids b
      JOIN couriers c ON c.id = b.courier_id AND c.user_id = profiles.id
      JOIN jobs j ON j.id = b.job_id AND j.customer_user_id = auth.uid()
    )
  );

-- Allow couriers to view customer profiles for jobs they bid on
CREATE POLICY "Couriers can view customer profiles for their bids"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 
      FROM bids b
      JOIN couriers c ON c.user_id = auth.uid()
      JOIN jobs j ON j.id = b.job_id AND j.customer_user_id = profiles.id
      WHERE b.courier_id = c.id
    )
  );

-- Drop and recreate the function without profiles reference
DROP POLICY IF EXISTS "Users can view participants in accessible conversations" ON conversation_participants;

DROP FUNCTION IF EXISTS can_view_conversation_participants(uuid, uuid);

CREATE OR REPLACE FUNCTION can_view_conversation_participants(target_conversation_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_participant boolean;
  is_assigned_admin boolean;
BEGIN
  -- Check if user is a participant in this conversation
  SELECT EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_id = target_conversation_id
    AND user_id = target_user_id
  ) INTO is_participant;

  IF is_participant THEN
    RETURN true;
  END IF;

  -- Check if user is assigned admin for this conversation
  SELECT EXISTS (
    SELECT 1 FROM conversations
    WHERE id = target_conversation_id
    AND assigned_admin_id = target_user_id
  ) INTO is_assigned_admin;

  RETURN is_assigned_admin;
END;
$$;

-- Recreate the policy
CREATE POLICY "Users can view participants in accessible conversations"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (can_view_conversation_participants(conversation_id, auth.uid()));
