/*
  # Update Platform Commission to 7.5%

  ## Overview
  Updates the courier earnings trigger to dynamically read the platform commission
  rate from platform_settings instead of using a hardcoded 0.90 (10%) fallback.
  This ensures any admin-configured commission rate is respected in all calculations.

  ## Changes

  1. **Updated Function: `update_courier_earnings`**
     - Now reads `platform_commission_percent` from `platform_settings` table
     - Falls back to 7.5% (the new default) if setting is not found
     - Uses dynamic rate: `1 - (commission / 100)` instead of hardcoded `0.90`

  ## Important Notes
  - The platform_settings table already has `platform_commission_percent` set to `7.5`
  - All new jobs created via the frontend already use the dynamic fee from platform_settings
  - This migration ensures the DB trigger also respects the dynamic setting
  - No data is modified; only the trigger function is updated
*/

CREATE OR REPLACE FUNCTION update_courier_earnings()
RETURNS TRIGGER AS $$
DECLARE
  v_fee_rate numeric;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' AND NEW.assigned_courier_id IS NOT NULL THEN
    SELECT COALESCE(
      (SELECT (100 - CAST(value AS numeric)) / 100
       FROM platform_settings
       WHERE key = 'platform_commission_percent'
       LIMIT 1),
      0.925
    ) INTO v_fee_rate;

    UPDATE couriers
    SET total_earnings_ttd = COALESCE(total_earnings_ttd, 0) + COALESCE(NEW.driver_net_earnings, ROUND(COALESCE(NEW.customer_offer_ttd, 0) * v_fee_rate, 2))
    WHERE id = NEW.assigned_courier_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
