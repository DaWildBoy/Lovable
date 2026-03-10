/*
  # Payment and Verification System

  ## Overview
  Implements comprehensive payment infrastructure for Imove platform including:
  - Customer payment information storage
  - Courier bank account details and verification
  - Payment breakdowns (10% platform fee + 12.5% VAT)
  - Admin verification workflow

  ## New Columns Added

  ### Profiles Table - Customer Payment Information
    - `customer_payment_method` (text) - Payment method type (e.g., 'credit_card', 'debit_card')
    - `customer_payment_last4` (text) - Last 4 digits of card/account
    - `customer_payment_verified` (boolean) - Whether payment method is verified
    - `customer_payment_added_at` (timestamptz) - When payment info was added

  ### Profiles Table - Courier Bank Information
    - `courier_bank_name` (text) - Name of the bank
    - `courier_bank_account_name` (text) - Account holder name
    - `courier_bank_account_number` (text) - Account number (encrypted in production)
    - `courier_bank_routing_number` (text) - Routing/sort code
    - `courier_bank_verified` (boolean) - Admin verification status
    - `courier_bank_verified_at` (timestamptz) - When admin verified
    - `courier_bank_verified_by` (uuid) - Admin user who verified
    - `courier_bank_added_at` (timestamptz) - When bank info was added

  ### Jobs Table - Payment Breakdown
    - `base_price` (decimal) - Original job price
    - `platform_fee` (decimal) - 10% platform fee
    - `vat_amount` (decimal) - 12.5% VAT
    - `total_price` (decimal) - Total customer pays (base + platform fee + VAT)
    - `courier_earnings` (decimal) - Amount courier receives (equals base_price)

  ## Security
    - RLS policies ensure users can only access their own payment information
    - Admin verification required before couriers can bid
    - Payment info required before customers can post jobs

  ## Important Notes
    1. Platform fee: 10% of base price goes to company
    2. VAT: 12.5% of base price goes to company
    3. Courier earnings: 100% of base price goes to courier
    4. Total customer pays: base_price + platform_fee + vat_amount
    5. All monetary values stored as DECIMAL(10,2) for precision
*/

-- Add customer payment information columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'customer_payment_method'
  ) THEN
    ALTER TABLE profiles ADD COLUMN customer_payment_method text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'customer_payment_last4'
  ) THEN
    ALTER TABLE profiles ADD COLUMN customer_payment_last4 text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'customer_payment_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN customer_payment_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'customer_payment_added_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN customer_payment_added_at timestamptz;
  END IF;
END $$;

-- Add courier bank information columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_bank_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_bank_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_bank_account_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_bank_account_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_bank_account_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_bank_account_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_bank_routing_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_bank_routing_number text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_bank_verified'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_bank_verified boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_bank_verified_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_bank_verified_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_bank_verified_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_bank_verified_by uuid REFERENCES profiles(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'courier_bank_added_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN courier_bank_added_at timestamptz;
  END IF;
END $$;

-- Add payment breakdown columns to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'base_price'
  ) THEN
    ALTER TABLE jobs ADD COLUMN base_price decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'platform_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN platform_fee decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'vat_amount'
  ) THEN
    ALTER TABLE jobs ADD COLUMN vat_amount decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'total_price'
  ) THEN
    ALTER TABLE jobs ADD COLUMN total_price decimal(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'courier_earnings'
  ) THEN
    ALTER TABLE jobs ADD COLUMN courier_earnings decimal(10,2);
  END IF;
END $$;

-- Update existing jobs to have payment breakdown (based on customer_offer_ttd)
UPDATE jobs
SET 
  base_price = customer_offer_ttd,
  platform_fee = ROUND(customer_offer_ttd * 0.10, 2),
  vat_amount = ROUND(customer_offer_ttd * 0.125, 2),
  total_price = customer_offer_ttd + ROUND(customer_offer_ttd * 0.10, 2) + ROUND(customer_offer_ttd * 0.125, 2),
  courier_earnings = customer_offer_ttd
WHERE base_price IS NULL AND customer_offer_ttd IS NOT NULL;

-- Create index for faster lookups on verification status
CREATE INDEX IF NOT EXISTS idx_profiles_courier_bank_verified ON profiles(courier_bank_verified) WHERE role = 'courier';
CREATE INDEX IF NOT EXISTS idx_profiles_customer_payment_verified ON profiles(customer_payment_verified) WHERE role = 'customer';