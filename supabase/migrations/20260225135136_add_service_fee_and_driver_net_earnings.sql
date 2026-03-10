/*
  # Add Service Fee and Driver Net Earnings Columns

  ## Overview
  Implements a dual-fee model where:
  - Customers pay a 10% Service Fee on top of the base fare
  - Drivers have a 10% Platform Fee deducted from the base fare
  - The platform collects both fees on job completion

  ## Changes

  1. **New Columns on `jobs` table**
     - `customer_service_fee` (decimal) - 10% booking fee charged to the customer
     - `customer_total` (decimal) - base fare + customer service fee (what the customer pays)
     - `driver_platform_fee` (decimal) - 10% platform fee deducted from the driver
     - `driver_net_earnings` (decimal) - base fare minus driver platform fee (what the driver receives)
     - `platform_revenue` (decimal) - total platform earnings (customer_service_fee + driver_platform_fee)

  2. **Updated Trigger**
     - `update_courier_earnings` trigger now credits `driver_net_earnings` instead of full `customer_offer_ttd`

  3. **Backfill**
     - Existing completed jobs are backfilled with the new fee calculations

  ## Important Notes
  - The base fare (`customer_offer_ttd`) is NOT changed
  - Existing `base_price`, `platform_fee`, `vat_amount`, `total_price`, `courier_earnings` columns are preserved for backward compatibility
  - The new columns take precedence in the UI going forward
*/

-- Add new fee tracking columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'customer_service_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN customer_service_fee decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'customer_total'
  ) THEN
    ALTER TABLE jobs ADD COLUMN customer_total decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'driver_platform_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN driver_platform_fee decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'driver_net_earnings'
  ) THEN
    ALTER TABLE jobs ADD COLUMN driver_net_earnings decimal(10,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'platform_revenue'
  ) THEN
    ALTER TABLE jobs ADD COLUMN platform_revenue decimal(10,2) DEFAULT 0;
  END IF;
END $$;

-- Backfill existing jobs with new fee calculations
UPDATE jobs
SET
  customer_service_fee = ROUND(COALESCE(customer_offer_ttd, 0) * 0.10, 2),
  customer_total = ROUND(COALESCE(customer_offer_ttd, 0) * 1.10, 2),
  driver_platform_fee = ROUND(COALESCE(customer_offer_ttd, 0) * 0.10, 2),
  driver_net_earnings = ROUND(COALESCE(customer_offer_ttd, 0) * 0.90, 2),
  platform_revenue = ROUND(COALESCE(customer_offer_ttd, 0) * 0.20, 2)
WHERE customer_service_fee IS NULL OR customer_service_fee = 0;

-- Update the courier earnings trigger to credit driver_net_earnings instead of full customer_offer_ttd
CREATE OR REPLACE FUNCTION update_courier_earnings()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.assigned_courier_id IS NOT NULL THEN
    UPDATE couriers
    SET total_earnings_ttd = COALESCE(total_earnings_ttd, 0) + COALESCE(NEW.driver_net_earnings, ROUND(COALESCE(NEW.customer_offer_ttd, 0) * 0.90, 2))
    WHERE id = NEW.assigned_courier_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
