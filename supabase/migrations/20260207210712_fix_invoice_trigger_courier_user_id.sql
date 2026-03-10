/*
  # Fix invoice generation trigger - courier_user_id foreign key mismatch

  1. Problem
    - The `generate_invoice_on_completion` trigger was using `NEW.assigned_courier_id` 
      (a couriers table ID) as the `courier_user_id` in the invoices table
    - The `invoices.courier_user_id` column has a foreign key to `auth.users(id)`
    - This caused a FK violation error, preventing job completion

  2. Fix
    - Look up the courier's actual `user_id` from the `couriers` table
    - Use that user_id for the invoice's `courier_user_id` column
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
      COALESCE(v_customer.full_name, v_customer.first_name || ' ' || v_customer.last_name, ''),
      COALESCE(v_customer.email, ''),
      COALESCE(v_courier.full_name, v_courier.first_name || ' ' || v_courier.last_name, ''),
      COALESCE(NEW.job_reference_id, ''),
      COALESCE(NEW.pickup_location, ''),
      COALESCE(NEW.dropoff_location, ''),
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
