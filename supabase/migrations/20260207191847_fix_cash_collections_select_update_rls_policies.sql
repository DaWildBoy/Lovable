/*
  # Fix remaining cash_collections RLS policies

  1. Changes
    - Fix SELECT policy for couriers: join through `couriers` table instead of
      comparing `assigned_courier_id` directly to `auth.uid()`
    - Fix UPDATE policy for couriers: same join-through fix

  2. Security
    - Couriers can only view/update cash collections for jobs they are assigned to
    - Ownership check via `couriers.user_id = auth.uid()`
*/

DROP POLICY IF EXISTS "Assigned couriers can view cash collections" ON public.cash_collections;

CREATE POLICY "Assigned couriers can view cash collections"
  ON public.cash_collections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN couriers ON couriers.id = jobs.assigned_courier_id
      WHERE jobs.id = cash_collections.job_id
      AND couriers.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Couriers can update own cash collections" ON public.cash_collections;

CREATE POLICY "Couriers can update own cash collections"
  ON public.cash_collections
  FOR UPDATE
  TO authenticated
  USING (collected_by_user_id = auth.uid())
  WITH CHECK (collected_by_user_id = auth.uid());
