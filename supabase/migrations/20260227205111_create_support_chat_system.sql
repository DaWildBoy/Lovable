/*
  # Create Support Chat System

  1. New Tables
    - `support_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users) - the customer/driver/retailer
      - `user_role` (text) - 'customer', 'courier', 'retailer'
      - `active_job_id` (uuid, nullable, references jobs)
      - `status` (text) - 'ai_active', 'human_requested', 'human_active', 'resolved'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `support_messages`
      - `id` (uuid, primary key)
      - `session_id` (uuid, references support_sessions)
      - `sender_type` (text) - 'user', 'ai', 'admin'
      - `sender_id` (uuid, nullable) - user or admin who sent the message
      - `content` (text)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can read/write their own sessions and messages
    - Admins can read all sessions and messages, and write admin messages

  3. Important Notes
    - The support_sessions table tracks AI vs human handoff state
    - The support_messages table stores the full chat history
    - Status flow: ai_active -> human_requested -> human_active -> resolved
*/

CREATE TABLE IF NOT EXISTS support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  user_role text NOT NULL DEFAULT 'customer',
  active_job_id uuid REFERENCES jobs(id),
  status text NOT NULL DEFAULT 'ai_active'
    CHECK (status IN ('ai_active', 'human_requested', 'human_active', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES support_sessions(id) ON DELETE CASCADE,
  sender_type text NOT NULL CHECK (sender_type IN ('user', 'ai', 'admin')),
  sender_id uuid REFERENCES auth.users(id),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE support_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_support_sessions_user_id ON support_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_support_sessions_status ON support_sessions(status);
CREATE INDEX IF NOT EXISTS idx_support_messages_session_id ON support_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_support_messages_created_at ON support_messages(session_id, created_at);

CREATE POLICY "Users can view own support sessions"
  ON support_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own support sessions"
  ON support_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own support sessions"
  ON support_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all support sessions"
  ON support_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );

CREATE POLICY "Admins can update all support sessions"
  ON support_sessions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );

CREATE POLICY "Users can view own session messages"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM support_sessions
      WHERE support_sessions.id = support_messages.session_id
      AND support_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own session messages"
  ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM support_sessions
      WHERE support_sessions.id = support_messages.session_id
      AND support_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all support messages"
  ON support_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );

CREATE POLICY "Admins can insert support messages"
  ON support_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );
