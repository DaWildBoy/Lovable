/*
  # Add Delivery Order Options and Proof System
  
  ## Overview
  This migration adds delivery order management and comprehensive delivery proof capture system.
  
  ## Changes to jobs table
  1. New Fields:
    - `delivery_order_type` (text) - Either 'sequential' or 'flexible'
      - sequential: cargo items must be delivered in specific order
      - flexible: courier can deliver in any order (default)
  
  ## Changes to cargo_items table
  2. New Delivery Proof Fields:
    - `delivery_proof_photo_url` (text) - URL to photo of delivered cargo
    - `delivery_signature_url` (text) - URL to recipient's e-signature image
    - `delivered_to_name` (text) - Full name of actual recipient who signed
    - `delivered_at` (timestamptz) - Exact timestamp when delivery was completed
    - `delivery_notes_from_courier` (text) - Optional notes from courier about delivery
  
  ## Important Notes
  - Delivery order type defaults to 'flexible' for backwards compatibility
  - All delivery proof fields are optional (nullable)
  - Timestamps are stored in UTC with timezone
  - Proof URLs point to Supabase Storage (delivery-proofs bucket)
*/

-- Add delivery order type to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'delivery_order_type'
  ) THEN
    ALTER TABLE jobs ADD COLUMN delivery_order_type text DEFAULT 'flexible' CHECK (delivery_order_type IN ('sequential', 'flexible'));
  END IF;
END $$;

-- Add delivery proof fields to cargo_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'delivery_proof_photo_url'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN delivery_proof_photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'delivery_signature_url'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN delivery_signature_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'delivered_to_name'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN delivered_to_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN delivered_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'delivery_notes_from_courier'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN delivery_notes_from_courier text;
  END IF;
END $$;