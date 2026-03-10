/*
  # Allow company drivers to view their linked company profile

  1. Changes
    - Updates the `can_view_profile` function to also return true when:
      - The viewer is a company driver with a `linked_company_id` matching the target profile
      - OR the viewer is a haulage company and the target is one of their linked drivers

  2. Security
    - Only allows viewing the specific linked company profile, not arbitrary profiles
    - Uses SECURITY DEFINER to bypass RLS within the function
*/

CREATE OR REPLACE FUNCTION public.can_view_profile(viewer_id uuid, target_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT
  (viewer_id = target_profile_id)
  OR EXISTS (
    SELECT 1 FROM jobs j
    JOIN couriers c ON c.id = j.assigned_courier_id
    WHERE c.user_id = target_profile_id
    AND j.customer_user_id = viewer_id
  )
  OR EXISTS (
    SELECT 1 FROM jobs j
    JOIN couriers c ON c.id = j.assigned_courier_id AND c.user_id = viewer_id
    WHERE j.customer_user_id = target_profile_id
  )
  OR EXISTS (
    SELECT 1 FROM bids b
    JOIN jobs j ON j.id = b.job_id
    JOIN couriers c ON c.id = b.courier_id
    WHERE c.user_id = target_profile_id
    AND j.customer_user_id = viewer_id
  )
  OR EXISTS (
    SELECT 1 FROM counter_offers co
    JOIN jobs j ON j.id = co.job_id
    JOIN couriers c ON c.id = co.courier_id
    WHERE c.user_id = target_profile_id
    AND j.customer_user_id = viewer_id
  )
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = viewer_id
    AND p.linked_company_id = target_profile_id
  )
  OR EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = target_profile_id
    AND p.linked_company_id = viewer_id
  );
$function$;
