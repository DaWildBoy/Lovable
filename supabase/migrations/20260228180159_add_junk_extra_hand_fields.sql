/*
  # Add junk removal extra hand and fee fields

  1. Modified Tables
    - `jobs`
      - `junk_need_extra_hand` (boolean, default false) - Whether the customer needs an extra helper for heavy/bulky items
      - `junk_extra_hand_fee` (numeric, default 0) - Fee charged for extra helper

  2. Important Notes
    - The existing `junk_heavy_lifting_fee` column now stores the "not on curb" fee ($100)
    - The new `junk_extra_hand_fee` column stores the extra helper fee ($150)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_need_extra_hand'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_need_extra_hand boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'junk_extra_hand_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN junk_extra_hand_fee numeric DEFAULT 0;
  END IF;
END $$;
