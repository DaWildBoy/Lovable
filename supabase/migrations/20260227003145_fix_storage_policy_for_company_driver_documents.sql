/*
  # Fix storage policy for company owners viewing driver license documents

  1. Problem
    - The existing storage SELECT policy for company owners uses a subquery
      against `haulage_drivers` which itself has RLS enabled
    - When the storage layer evaluates the policy, the nested RLS evaluation
      can fail or return empty results, causing signed URL generation to fail
    - This results in "No driver's license uploaded" even when files exist

  2. Solution
    - Create a SECURITY DEFINER helper function that checks if a user is the
      company owner of a driver (bypasses haulage_drivers RLS)
    - Update the storage policy to use this helper function instead of a direct subquery
    - This ensures the company owner can always generate signed URLs for their drivers' documents

  3. Security
    - The helper function only returns a boolean - no data leakage
    - Still validates that the caller owns the company the driver belongs to
*/

CREATE OR REPLACE FUNCTION is_company_owner_of_driver_folder(folder_owner_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM haulage_drivers hd
    WHERE hd.company_id = auth.uid()
    AND hd.user_id::text = folder_owner_id
    AND hd.is_active = true
  );
END;
$$;

DROP POLICY IF EXISTS "Company owners can view driver license documents" ON storage.objects;

CREATE POLICY "Company owners can view driver license documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'driver-id-documents'
    AND is_company_owner_of_driver_folder((storage.foldername(name))[1])
  );
