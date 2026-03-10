/*
  # Add Business Type Field to Profiles

  1. New Column
    - `business_type` (text) - Type of business: 'haulage' or 'retail'
      - 'haulage': Trucking/haulage companies that can see and bid on jobs (courier dashboard)
      - 'retail': Retail businesses that can post jobs (customer dashboard)
  
  2. Purpose
    - Allow business users to specify their business type during profile completion
    - Determine which dashboard to show based on business type
    - Haulage companies get courier-like functionality
    - Retail businesses get customer-like functionality
  
  3. Constraints
    - Only valid for business role users
    - Must be either 'haulage' or 'retail'
*/

-- Add business_type field to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_type'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_type text CHECK (business_type IN ('haulage', 'retail'));
  END IF;
END $$;
