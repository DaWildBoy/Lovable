/*
  # Business Subscription System

  1. New Tables
    - `business_subscriptions`
      - `id` (uuid, primary key)
      - `business_user_id` (uuid, references profiles) - the business owner
      - `plan_type` (text) - 'monthly'
      - `status` (text) - 'pending_payment_info', 'trial', 'active', 'past_due', 'suspended', 'cancelled'
      - `trial_start_date` (timestamptz) - when trial began
      - `trial_end_date` (timestamptz) - when trial ends (3 months after start)
      - `current_period_start` (timestamptz)
      - `current_period_end` (timestamptz)
      - `monthly_amount_ttd` (numeric) - monthly subscription fee in TTD
      - `billing_bank_name` (text)
      - `billing_bank_account_name` (text)
      - `billing_bank_account_number` (text)
      - `billing_bank_routing_number` (text)
      - `payment_info_added_at` (timestamptz)
      - `last_payment_date` (timestamptz)
      - `last_payment_amount_ttd` (numeric)
      - `next_billing_date` (timestamptz)
      - `created_at` / `updated_at`

    - `subscription_payments`
      - `id` (uuid, primary key)
      - `subscription_id` (uuid, references business_subscriptions)
      - `business_user_id` (uuid, references profiles)
      - `amount_ttd` (numeric)
      - `payment_method` (text) - 'bank_transfer', 'cash', 'cheque'
      - `payment_reference` (text) - bank transfer reference number
      - `status` (text) - 'pending', 'confirmed', 'rejected'
      - `period_start` / `period_end` (timestamptz) - the billing period this covers
      - `confirmed_by_admin_id` (uuid) - admin who confirmed payment
      - `confirmed_at` (timestamptz)
      - `notes` (text)
      - `created_at`

  2. Security
    - Enable RLS on both tables
    - Business users can read their own subscription and payments
    - Business users can insert/update their own subscription (payment info)
    - Admins can read all subscriptions and payments
    - Admins can update subscription status and confirm payments
*/

-- Business Subscriptions table
CREATE TABLE IF NOT EXISTS business_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_user_id uuid NOT NULL REFERENCES profiles(id),
  plan_type text NOT NULL DEFAULT 'monthly',
  status text NOT NULL DEFAULT 'pending_payment_info',
  trial_start_date timestamptz,
  trial_end_date timestamptz,
  current_period_start timestamptz,
  current_period_end timestamptz,
  monthly_amount_ttd numeric NOT NULL DEFAULT 500.00,
  billing_bank_name text,
  billing_bank_account_name text,
  billing_bank_account_number text,
  billing_bank_routing_number text,
  payment_info_added_at timestamptz,
  last_payment_date timestamptz,
  last_payment_amount_ttd numeric,
  next_billing_date timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(business_user_id)
);

ALTER TABLE business_subscriptions ENABLE ROW LEVEL SECURITY;

-- Business users can view their own subscription
CREATE POLICY "Business users can view own subscription"
  ON business_subscriptions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = business_user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Business users can create their own subscription
CREATE POLICY "Business users can create own subscription"
  ON business_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = business_user_id);

-- Business users can update their own subscription (payment info only)
-- Admins can update any subscription (status changes, payment confirmation)
CREATE POLICY "Business or admin can update subscription"
  ON business_subscriptions FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = business_user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = business_user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Subscription Payments table
CREATE TABLE IF NOT EXISTS subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES business_subscriptions(id),
  business_user_id uuid NOT NULL REFERENCES profiles(id),
  amount_ttd numeric NOT NULL,
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  payment_reference text,
  status text NOT NULL DEFAULT 'pending',
  period_start timestamptz,
  period_end timestamptz,
  confirmed_by_admin_id uuid REFERENCES profiles(id),
  confirmed_at timestamptz,
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE subscription_payments ENABLE ROW LEVEL SECURITY;

-- Business users can view their own payments, admins can view all
CREATE POLICY "Business users can view own payments"
  ON subscription_payments FOR SELECT
  TO authenticated
  USING (
    auth.uid() = business_user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Business users can create payment records for their subscription
CREATE POLICY "Business users can create own payment records"
  ON subscription_payments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = business_user_id);

-- Only admins can update payment records (confirm/reject)
CREATE POLICY "Admins can update payment records"
  ON subscription_payments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_user ON business_subscriptions(business_user_id);
CREATE INDEX IF NOT EXISTS idx_business_subscriptions_status ON business_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status);
