/*
  # Add Admin Audit Log and Platform Settings

  1. New Tables
    - `admin_audit_log`
      - `id` (uuid, primary key)
      - `admin_user_id` (uuid, references auth.users)
      - `action` (text) - e.g. 'approve_courier', 'reject_business', 'change_role', 'reset_password'
      - `target_type` (text) - e.g. 'user', 'company', 'subscription', 'settings'
      - `target_id` (text) - ID of the affected entity
      - `details` (jsonb) - additional context about the action
      - `created_at` (timestamptz)
    - `platform_settings`
      - `id` (uuid, primary key)
      - `key` (text, unique) - setting identifier
      - `value` (text) - setting value
      - `updated_by` (uuid, references auth.users)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Admin users can read audit logs
    - Super admins can insert audit logs and manage platform settings
    - All admin roles can read platform settings

  3. Seed Data
    - Default platform settings for fees, toggles, and controls
*/

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text NOT NULL DEFAULT '',
  target_id text NOT NULL DEFAULT '',
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read audit logs"
  ON admin_audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin', 'verification_admin')
    )
  );

CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = admin_user_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin', 'verification_admin')
    )
  );

CREATE TABLE IF NOT EXISTS platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read platform settings"
  ON platform_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('super_admin', 'support_admin', 'verification_admin')
    )
  );

CREATE POLICY "Super admins can update platform settings"
  ON platform_settings
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Super admins can insert platform settings"
  ON platform_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

INSERT INTO platform_settings (key, value) VALUES
  ('platform_commission_percent', '10'),
  ('minimum_job_price_ttd', '50'),
  ('business_subscription_fee_ttd', '500'),
  ('email_notifications', 'true'),
  ('push_notifications', 'true'),
  ('maintenance_mode', 'false'),
  ('auto_approve_couriers', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin_user ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON admin_audit_log(action);
