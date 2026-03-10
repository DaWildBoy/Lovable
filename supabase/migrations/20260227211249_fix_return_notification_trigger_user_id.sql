/*
  # Fix notify_delivery_return_initiated trigger - wrong user_id

  1. Bug Fix
    - The trigger was inserting `assigned_courier_id` (a courier record ID) directly
      into `notifications.user_id`, which expects an `auth.users` ID
    - This caused a foreign key violation: `notifications_user_id_fkey`
    - The profile lookup also used the wrong ID to resolve the courier name

  2. Changes
    - Look up the courier's `user_id` from the `couriers` table (same pattern used
      by other trigger functions like `notify_job_status_change`)
    - Use the resolved user_id for both the profile name lookup and the notification insert
    - Skip the driver notification if no matching courier user is found
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
  END IF;

  RETURN NEW;
END;
$$;
