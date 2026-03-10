/*
  # Fix Infinite Recursion in Conversation Participants

  1. Problem
    - The SELECT policy on conversation_participants queries conversation_participants itself
    - This creates infinite recursion when checking permissions

  2. Solution
    - Create SECURITY DEFINER function to check if user can view participants
    - Update policy to use this function instead of recursive query

  3. Security
    - Function checks if user is participant, admin, or assigned admin
    - Maintains same security guarantees without recursion
*/

-- Create helper function to check if user can view conversation participants
CREATE OR REPLACE FUNCTION can_view_conversation_participants(target_conversation_id uuid, target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_participant boolean;
  is_admin boolean;
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
  
  IF is_assigned_admin THEN
    RETURN true;
  END IF;
  
  -- Check if user is a global admin
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = target_user_id
    AND role = 'admin'
  ) INTO is_admin;
  
  RETURN is_admin;
END;
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view participants in accessible conversations" ON conversation_participants;

-- Create new policy using the helper function
CREATE POLICY "Users can view participants in accessible conversations"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    can_view_conversation_participants(conversation_id, auth.uid())
  );
