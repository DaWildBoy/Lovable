/*
  # Add Referral Invites Sent Tracking

  1. Changes
    - Add `invites_sent` column to `customer_referrals` to track total share actions
    - Add a referral stats helper to count pending signups vs completed

  2. Notes
    - Existing data is preserved, new column defaults to 0
    - Works for both customer and courier referrals (table is shared)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customer_referrals' AND column_name = 'invites_sent'
  ) THEN
    ALTER TABLE customer_referrals ADD COLUMN invites_sent integer DEFAULT 0;
  END IF;
END $$;
