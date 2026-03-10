/*
  # Add Cargo Insurance and Declared Value Fields

  1. Modified Tables
    - `jobs`
      - `declared_cargo_value` (numeric) - Estimated value of items in TTD, entered by customer
      - `cargo_insurance_enabled` (boolean) - Whether the customer opted into cargo insurance
      - `cargo_insurance_fee` (numeric) - Calculated insurance fee (1.5% of declared value)
      - `is_high_value` (boolean) - Auto-flagged true when declared value exceeds $20,000 TTD

  2. Important Notes
    - These fields are all optional/defaulted for backward compatibility
    - High-value jobs (>$20,000 TTD) are tagged for filtered driver assignment
    - Insurance fee is a separate line item added to the job total
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'declared_cargo_value'
  ) THEN
    ALTER TABLE jobs ADD COLUMN declared_cargo_value numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cargo_insurance_enabled'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cargo_insurance_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'cargo_insurance_fee'
  ) THEN
    ALTER TABLE jobs ADD COLUMN cargo_insurance_fee numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'is_high_value'
  ) THEN
    ALTER TABLE jobs ADD COLUMN is_high_value boolean DEFAULT false;
  END IF;
END $$;
