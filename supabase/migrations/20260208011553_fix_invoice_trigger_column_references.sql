/*
  # Fix invoice generation trigger - correct column name references

  1. Problem
    - The trigger referenced `NEW.pickup_location` and `NEW.dropoff_location`
      which do not exist on the jobs table
    - The actual column names are `pickup_location_text` and `dropoff_location_text`
    - This caused a runtime error blocking job completion

  2. Fix
    - Use correct column names: `pickup_location_text` and `dropoff_location_text`
    - Properly resolve courier user_id from couriers table
    - Use COALESCE with proper defaults for all NOT NULL invoice columns
*/

CREATE OR REPLACE FUNCTION generate_invoice_on_completion()
RETURNS trigger AS $$
DECLARE
  v_customer profiles%ROWTYPE;
  v_courier profiles%ROWTYPE;
  v_courier_user_id uuid;
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
      COALESCE(NEW.total_price, 0),
      COALESCE(NEW.courier_earnings, 0),
      'sent'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
