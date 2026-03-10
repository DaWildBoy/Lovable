/*
  # Fix cash_collections INSERT RLS policy

  1. Changes
    - Drop and recreate the INSERT policy on `cash_collections`
    - The old policy incorrectly compared `jobs.assigned_courier_id` directly to `auth.uid()`
    - `assigned_courier_id` references `couriers.id`, not the user's auth ID
    - New policy joins through the `couriers` table to correctly match the authenticated user

  2. Security
    - Couriers can only insert cash collections for jobs they are assigned to
    - The `collected_by_user_id` must match the authenticated user
*/

DROP POLICY IF EXISTS "Assigned couriers can create cash collections" ON public.cash_collections;

CREATE POLICY "Assigned couriers can create cash collections"
  ON public.cash_collections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    collected_by_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs
      JOIN couriers ON couriers.id = jobs.assigned_courier_id
      WHERE jobs.id = cash_collections.job_id
      AND couriers.user_id = auth.uid()
    )
  );
