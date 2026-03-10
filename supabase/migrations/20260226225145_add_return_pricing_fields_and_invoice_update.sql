/*
  # Return-to-Base (Reverse Logistics) Pricing Fields

  1. New Columns on `jobs`
    - `return_platform_fee` (numeric, default 0) - Platform fee on return leg (waived = 0)
    - `return_driver_payout` (numeric, default 0) - Driver keeps 100% of return fee
    - `return_base_transport_cost` (numeric, default 0) - Base transport cost excluding insurance/extras

  2. New Column on `invoices`
    - `return_fee` (numeric, default 0) - Return-to-base fee line item

  3. Updated Invoice Trigger
    - Now includes return_fee in generated invoices
    - Calculates driver payout as: (original net earnings) + return_fee

  4. Important Notes
    - Platform fee waiver on return leg: return_platform_fee always = 0
    - Driver gets 100% of return fee: return_driver_payout = return_fee
    - Return fee = 50% of base transport cost (excluding insurance, extras)
*/

-- Add return pricing columns to jobs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'return_platform_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN return_platform_fee numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'return_driver_payout'
  ) THEN
    ALTER TABLE jobs ADD COLUMN return_driver_payout numeric NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'return_base_transport_cost'
  ) THEN
    ALTER TABLE jobs ADD COLUMN return_base_transport_cost numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add return_fee column to invoices
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'return_fee'
  ) THEN
    ALTER TABLE invoices ADD COLUMN return_fee numeric NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Update invoice generation trigger to include return fee
CREATE OR REPLACE FUNCTION generate_invoice_on_completion()
RETURNS trigger AS $$
DECLARE
  v_customer profiles%ROWTYPE;
  v_courier profiles%ROWTYPE;
  v_courier_user_id uuid;
  v_return_fee numeric;
  v_total_with_return numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT * INTO v_customer FROM profiles WHERE id = NEW.customer_user_id;

    IF NEW.assigned_courier_id IS NOT NULL THEN
      SELECT user_id INTO v_courier_user_id
      FROM couriers
      WHERE id = NEW.assigned_courier_id;

      IF v_courier_user_id IS NOT NULL THEN
        SELECT * INTO v_courier FROM profiles WHERE id = v_courier_user_id;
      END IF;
    END IF;

    v_return_fee := COALESCE(NEW.return_fee, 0);
    v_total_with_return := COALESCE(NEW.total_price, 0);

    INSERT INTO invoices (
      job_id,
      customer_user_id,
      courier_user_id,
      customer_name,
      customer_email,
      courier_name,
      job_reference_id,
      pickup_location,
      dropoff_location,
      delivery_type,
      base_price,
      platform_fee,
      vat_amount,
      total_price,
      courier_earnings,
      detention_fee,
      return_fee,
      status
    ) VALUES (
      NEW.id,
      NEW.customer_user_id,
      v_courier_user_id,
      COALESCE(v_customer.full_name, CONCAT_WS(' ', v_customer.first_name, v_customer.last_name), ''),
      COALESCE(v_customer.email, ''),
      COALESCE(v_courier.full_name, CONCAT_WS(' ', v_courier.first_name, v_courier.last_name), ''),
      COALESCE(NEW.job_reference_id, ''),
      COALESCE(NEW.pickup_location_text, ''),
      COALESCE(NEW.dropoff_location_text, ''),
      COALESCE(NEW.delivery_type, ''),
      COALESCE(NEW.base_price, 0),
      COALESCE(NEW.platform_fee, 0),
      COALESCE(NEW.vat_amount, 0),
      v_total_with_return,
      COALESCE(NEW.courier_earnings, 0),
      COALESCE(NEW.detention_fee, 0),
      v_return_fee,
      'sent'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill existing jobs that have return_fee > 0
UPDATE jobs
SET
  return_platform_fee = 0,
  return_driver_payout = return_fee,
  return_base_transport_cost = COALESCE(customer_offer_ttd, 0)
WHERE return_fee > 0
  AND return_driver_payout = 0;
