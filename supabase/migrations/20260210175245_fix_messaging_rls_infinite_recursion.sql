/*
  # Fix Messaging RLS Infinite Recursion

  1. Problem
    - The conversation_participants SELECT policy references itself in a subquery,
      causing infinite recursion when PostgreSQL evaluates RLS
    - The conversations SELECT policy also queries conversation_participants,
      creating a cross-table cycle

  2. Solution
    - Create a SECURITY DEFINER helper function `get_user_conversation_ids()`
      that bypasses RLS to fetch conversation IDs for the current user
    - Replace self-referencing subqueries in ALL messaging RLS policies
      with calls to this helper function
    - This breaks the recursion cycle since the function runs with
      elevated privileges and doesn't trigger RLS checks

  3. Security Changes
    - Drop and recreate SELECT policies on conversations, conversation_participants, and messages
    - All policies still require authenticated role
    - Ownership checks remain intact (auth.uid() based)
    - Super admin bypass policies are preserved

  4. Important Notes
    - The helper function only returns conversation IDs for the calling user
    - SECURITY DEFINER is safe here because the function only reads
      conversation_participants filtered by auth.uid()
*/

CREATE OR REPLACE FUNCTION get_user_conversation_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conversation_id
  FROM conversation_participants
  WHERE user_id = auth.uid();
$$;

DROP POLICY IF EXISTS "Users can view their conversations" ON conversations;
CREATE POLICY "Users can view their conversations"
  ON conversations
  FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT get_user_conversation_ids())
    OR assigned_admin_id = auth.uid()
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Super admins can view all conversations" ON conversations;

DROP POLICY IF EXISTS "Users can view participants in their conversations" ON conversation_participants;
CREATE POLICY "Users can view participants in their conversations"
  ON conversation_participants
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR conversation_id IN (SELECT get_user_conversation_ids())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Super admins can view all conversation participants" ON conversation_participants;

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations"
  ON messages
  FOR SELECT
  TO authenticated
  USING (
    conversation_id IN (SELECT get_user_conversation_ids())
    OR is_super_admin()
  );

DROP POLICY IF EXISTS "Super admins can view all messages" ON messages;
