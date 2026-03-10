/*
  # Replace Messaging System with Comprehensive Design

  ## Overview
  Replaces the existing simple messages and ai_support_conversations tables
  with a full-featured messaging system that supports:
  - AI-powered customer support bot
  - Direct messaging between customers and couriers
  - Admin staff support and monitoring
  - Real-time message delivery

  ## Changes
  1. Drop existing messages and ai_support_conversations tables
  2. Create new conversations-based messaging system

  ## New Tables

  ### conversations
  Stores all conversation threads
  - `id` (uuid, primary key)
  - `type` ('support' or 'job')
  - `job_id` (uuid, nullable) - for job conversations
  - `status` ('active', 'resolved', 'escalated')
  - `assigned_admin_id` (uuid, nullable)
  - `last_message_at` (timestamptz)
  - `created_at`, `updated_at` (timestamptz)

  ### conversation_participants
  Tracks conversation membership
  - `conversation_id`, `user_id` (composite primary key)
  - `joined_at`, `last_read_at` (timestamptz)

  ### messages
  Stores individual messages
  - `id` (uuid, primary key)
  - `conversation_id` (uuid)
  - `sender_id` (uuid, nullable) - null for AI bot
  - `sender_type` ('user', 'bot', 'admin')
  - `content` (text)
  - `metadata` (jsonb) - for attachments, etc.
  - `created_at` (timestamptz)

  ## Security
  - RLS enabled on all tables
  - Users see only their conversations
  - Admins see all conversations
*/

-- Drop existing tables
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS ai_support_conversations CASCADE;

-- Create conversations table
CREATE TABLE conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('support', 'job')),
  job_id uuid REFERENCES jobs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'escalated')),
  assigned_admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  last_message_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create conversation_participants table
CREATE TABLE conversation_participants (
  conversation_id uuid REFERENCES conversations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at timestamptz DEFAULT now(),
  last_read_at timestamptz DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

-- Create messages table
CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'bot', 'admin')),
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC);
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conversations_job_id ON conversations(job_id) WHERE job_id IS NOT NULL;

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view their conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
    )
    OR
    conversations.assigned_admin_id = auth.uid()
  );

CREATE POLICY "Admins can view all conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can create support conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (type = 'support');

CREATE POLICY "Users can create job conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (
    type = 'job'
    AND job_id IN (
      SELECT id FROM jobs
      WHERE customer_user_id = auth.uid()
      OR assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Admins can update conversations"
  ON conversations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Conversation participants policies
CREATE POLICY "Users can view their participant records"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can join conversations"
  ON conversation_participants FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their participant records"
  ON conversation_participants FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
      AND cp.user_id = auth.uid()
    )
  );

-- Function to update conversation timestamp
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at,
      updated_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for timestamp updates
CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();