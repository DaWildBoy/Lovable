/*
  # Allow drivers to update their own license fields on haulage_drivers

  1. Problem
    - When a courier uploads their driver's license during onboarding, the app
      updates haulage_drivers with the storage paths (license_front_url, license_back_url)
    - The existing UPDATE policy only allows company owners (company_id = auth.uid())
    - Drivers (user_id = auth.uid()) had no UPDATE permission, so the update silently failed
    - This caused license images to be uploaded to storage but never linked in the database

  2. Solution
    - Add an UPDATE policy allowing linked drivers to update ONLY their own record
    - The USING clause ensures they can only target their own row
    - The WITH CHECK clause ensures they cannot change the row to belong to someone else

  3. Security
    - Drivers can only update rows where user_id matches their auth.uid()
    - WITH CHECK ensures user_id remains their own after the update
*/

CREATE POLICY "Linked drivers can update own record"
  ON haulage_drivers
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
