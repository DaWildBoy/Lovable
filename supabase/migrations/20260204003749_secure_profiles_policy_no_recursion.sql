/*
  # Secure Profiles Policy Without Recursion

  1. Changes
    - Replace overly permissive policy with secure one
    - Users can view their own profile
    - Users can view profiles through message conversations (safe, no recursion)
    - No complex joins that could cause infinite loops

  2. Security
    - Restrictive by default
    - Uses only tables that don't reference profiles in their policies
*/

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view profiles" ON profiles;

-- Create secure policies
CREATE POLICY "Users can view own profile"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow viewing profiles of users you're in a conversation with
CREATE POLICY "Users can view conversation participants profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp1
      JOIN conversation_participants cp2 ON cp2.conversation_id = cp1.conversation_id
      WHERE cp1.user_id = auth.uid()
      AND cp2.user_id = profiles.id
    )
  );
