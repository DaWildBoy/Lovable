/*
  # Allow Business Accounts to View Jobs

  1. Changes
    - Updates the "Approved couriers can view open jobs" policy to also allow approved business accounts
    - This enables haulage and retail companies to browse available jobs
  
  2. Security
    - Business accounts must have `business_verification_status = 'approved'`
    - Still restricts to open/bidding status jobs only
    - Maintains existing courier access
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Approved couriers can view open jobs" ON jobs;

-- Create updated policy that includes business accounts
CREATE POLICY "Approved couriers and businesses can view open jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    (status = ANY (ARRAY['open'::text, 'bidding'::text])) 
    AND 
    (
      -- Allow approved couriers
      EXISTS (
        SELECT 1 FROM couriers
        WHERE couriers.user_id = auth.uid() 
        AND couriers.verification_status = 'approved'
      )
      OR
      -- Allow approved business accounts (haulage/retail)
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'business'
        AND profiles.business_verification_status = 'approved'
      )
    )
  );
