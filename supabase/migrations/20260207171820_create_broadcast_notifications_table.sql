/*
  # Create broadcast notifications system

  1. New Tables
    - `broadcast_notifications`
      - `id` (uuid, primary key) - unique broadcast identifier
      - `admin_id` (uuid, references auth.users) - admin who sent the broadcast
      - `title` (text) - notification title
      - `message` (text) - notification body
      - `type` (text) - notification type: announcement, promo, traffic_alert, platform_update, system_announcement
      - `target_audience` (text) - who receives it: all, customers, couriers, businesses
      - `recipients_count` (integer) - number of users who received it
      - `created_at` (timestamptz) - when the broadcast was sent

  2. Security
    - Enable RLS on `broadcast_notifications` table
    - Only admins can insert broadcasts
    - Only admins can view broadcast history
*/

CREATE TABLE IF NOT EXISTS broadcast_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'announcement',
  target_audience text NOT NULL DEFAULT 'all',
  recipients_count integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE broadcast_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view broadcast history"
  ON broadcast_notifications
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );

CREATE POLICY "Admins can insert broadcasts"
  ON broadcast_notifications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin')
    )
  );

CREATE INDEX IF NOT EXISTS idx_broadcast_notifications_created_at
  ON broadcast_notifications (created_at DESC);
