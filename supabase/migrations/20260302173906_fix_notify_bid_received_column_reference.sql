/*
  # Fix notify_bid_received trigger function column reference

  1. Changes
    - Fix `notify_bid_received()` function to reference `NEW.amount_ttd` instead of `NEW.bid_amount_ttd`
    - The `bids` table column is `amount_ttd`, not `bid_amount_ttd`

  2. Impact
    - Fixes "record new has no field bid_amount_ttd" error when placing bids
*/

CREATE OR REPLACE FUNCTION public.notify_bid_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  job_customer_id uuid;
BEGIN
  SELECT customer_user_id INTO job_customer_id
  FROM jobs
  WHERE id = NEW.job_id;

  IF job_customer_id IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      job_customer_id,
      'bid_received',
      'New Bid Received!',
      'A trucker has placed a bid of TTD $' || NEW.amount_ttd || ' on your delivery job.',
      jsonb_build_object('job_id', NEW.job_id, 'bid_id', NEW.id, 'bid_amount', NEW.amount_ttd)
    );
  END IF;

  RETURN NEW;
END;
$function$;