/*
  # Add Proof of Delivery field to jobs table

  1. Changes
    - Add `proof_of_delivery` column to `jobs` table
      - Type: text with check constraint
      - Allowed values: 'photo', 'signature', 'photo_and_signature', 'none'
      - Default: 'photo_and_signature' (recommended for retail)
      - Used by Retail businesses to specify delivery verification requirements

  2. Notes
    - This field is primarily used by Retail business type
    - The selected proof type will be enforced during courier delivery completion
    - Default value ensures all retail deliveries require both photo and signature unless explicitly changed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'proof_of_delivery'
  ) THEN
    ALTER TABLE jobs ADD COLUMN proof_of_delivery text DEFAULT 'photo_and_signature'
      CHECK (proof_of_delivery IN ('photo', 'signature', 'photo_and_signature', 'none'));
  END IF;
END $$;