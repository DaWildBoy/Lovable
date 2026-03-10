/*
  # Add haulage company notification on delivery return

  1. Changes
    - Updated `notify_delivery_return_initiated` trigger to also notify the
      haulage company (`assigned_company_id`) when a company driver initiates
      a return
    - The notification includes the driver name, return reason, and return fee
    - Only fires when the job has an `assigned_company_id` (haulage dispatch)

  2. Notification Details
    - Type: `delivery_return_company`
    - Sent to: haulage company account
    - Includes: job reference, driver name, reason, return fee
*/

CREATE OR REPLACE FUNCTION notify_delivery_return_initiated()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_courier_user_id uuid;
  v_courier_name text;
  v_reason_text text;
  v_job_ref text;
BEGIN
  IF NEW.status = 'returning' AND OLD.status != 'returning' THEN
    IF NEW.assigned_courier_id IS NOT NULL THEN
      SELECT user_id INTO v_courier_user_id
      FROM couriers
      WHERE id = NEW.assigned_courier_id;
    END IF;

    SELECT COALESCE(full_name, first_name || ' ' || last_name, 'Driver')
    INTO v_courier_name
    FROM profiles
    WHERE id = v_courier_user_id;

    v_job_ref := COALESCE(NEW.job_reference_id, LEFT(NEW.id::text, 8));

    CASE NEW.return_reason
      WHEN 'customer_refused' THEN v_reason_text := 'Customer Refused Item';
      WHEN 'item_does_not_fit' THEN v_reason_text := 'Item Does Not Fit';
      WHEN 'wrong_address_unavailable' THEN v_reason_text := 'Wrong Address / Customer Unavailable';
      WHEN 'item_damaged' THEN v_reason_text := 'Item Damaged';
      ELSE v_reason_text := COALESCE(NEW.return_reason, 'Unknown');
    END CASE;

    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      data
    ) VALUES (
      NEW.customer_user_id,
      'delivery_return',
      'Delivery Returning to Base',
      'Job #' || v_job_ref || ' is returning to base. Reason: ' || v_reason_text || '. Return fee of $' || COALESCE(NEW.return_fee, 0) || ' TTD applied.',
      jsonb_build_object(
        'job_id', NEW.id,
        'return_reason', NEW.return_reason,
        'return_notes', COALESCE(NEW.return_notes, ''),
        'return_fee', COALESCE(NEW.return_fee, 0),
        'courier_name', v_courier_name
      )
    );

    IF v_courier_user_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data
      ) VALUES (
        v_courier_user_id,
        'delivery_return_confirmed',
        'Return Trip Initiated',
        'Return initiated for Job #' || v_job_ref || '. Please take item back to pickup point. Return fee of $' || COALESCE(NEW.return_fee, 0) || ' TTD earned.',
        jsonb_build_object(
          'job_id', NEW.id,
          'return_fee', COALESCE(NEW.return_fee, 0),
          'pickup_location', COALESCE(NEW.pickup_location_text, '')
        )
      );
    END IF;

    IF NEW.assigned_company_id IS NOT NULL THEN
      INSERT INTO notifications (
        user_id,
        type,
        title,
        message,
        data
      ) VALUES (
        NEW.assigned_company_id,
        'delivery_return_company',
        'Driver Initiated Return',
        'Driver ' || COALESCE(v_courier_name, NEW.assigned_driver_name, 'Unknown') || ' initiated a return for Job #' || v_job_ref || '. Reason: ' || v_reason_text || '. Return fee: $' || COALESCE(NEW.return_fee, 0) || ' TTD.',
        jsonb_build_object(
          'job_id', NEW.id,
          'return_reason', NEW.return_reason,
          'return_notes', COALESCE(NEW.return_notes, ''),
          'return_fee', COALESCE(NEW.return_fee, 0),
          'driver_name', COALESCE(v_courier_name, NEW.assigned_driver_name, 'Unknown'),
          'vehicle_label', COALESCE(NEW.assigned_vehicle_label, '')
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
