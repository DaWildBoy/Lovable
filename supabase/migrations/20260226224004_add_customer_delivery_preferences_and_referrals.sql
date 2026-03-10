/*
  # Add Customer Delivery Preferences and Referral System

  1. New Tables
    - `customer_delivery_preferences`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles.id)
      - `default_delivery_instructions` (text) - e.g., "Call on arrival", "Leave at gate"
      - `preferred_vehicle_type` (text) - preferred vehicle type for deliveries
      - `default_tip_percentage` (integer) - default tip percentage
      - `sms_notifications` (boolean) - receive SMS notifications
      - `email_notifications` (boolean) - receive email notifications
      - `push_notifications` (boolean) - receive push notifications
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `customer_referrals`
      - `id` (uuid, primary key)
      - `referrer_user_id` (uuid, references profiles.id) - user who shared the code
      - `referral_code` (text, unique) - the code shared
      - `referred_user_id` (uuid, nullable, references profiles.id) - user who signed up
      - `status` (text) - pending, completed, expired
      - `reward_amount_ttd` (numeric) - reward earned
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Users can only access their own preferences and referral data
*/

-- Customer Delivery Preferences
CREATE TABLE IF NOT EXISTS customer_delivery_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id),
  default_delivery_instructions text DEFAULT '',
  preferred_vehicle_type text DEFAULT '',
  default_tip_percentage integer DEFAULT 0,
  sms_notifications boolean DEFAULT true,
  email_notifications boolean DEFAULT true,
  push_notifications boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE customer_delivery_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own delivery preferences"
  ON customer_delivery_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own delivery preferences"
  ON customer_delivery_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own delivery preferences"
  ON customer_delivery_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Customer Referrals
CREATE TABLE IF NOT EXISTS customer_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id uuid NOT NULL REFERENCES profiles(id),
  referral_code text NOT NULL UNIQUE,
  referred_user_id uuid REFERENCES profiles(id),
  status text DEFAULT 'pending',
  reward_amount_ttd numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE customer_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referrals"
  ON customer_referrals FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

CREATE POLICY "Users can create own referrals"
  ON customer_referrals FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referrer_user_id);
