/*
  # Add Haulage Company Code and Driver Linking

  1. Changes to `profiles` table
    - `haulage_company_code` (text, unique) - Auto-generated code for haulage companies
      that drivers can use to link themselves during onboarding

  2. Changes to `haulage_drivers` table
    - `user_id` (uuid, nullable) - Links a fleet driver record to an actual app user account
    - Unique constraint on (company_id, user_id) to prevent duplicate links

  3. New Functions
    - `generate_company_code()` - Generates a unique 8-character alphanumeric code
    - `auto_generate_company_code()` - Trigger function that auto-generates a code
      for haulage profiles when they complete onboarding
    - `link_courier_to_company(code, courier_user_id)` - RPC function that validates
      a company code and creates a driver link

  4. Security
    - RLS policy allowing couriers to call the linking RPC
    - Updated haulage_drivers policies to allow linked drivers to see their own record
*/

-- Add company code column to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'haulage_company_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN haulage_company_code text UNIQUE;
  END IF;
END $$;

-- Add user_id column to haulage_drivers for linking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'haulage_drivers' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE haulage_drivers ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- Add unique constraint so a user can only be linked once per company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'haulage_drivers_company_user_unique'
  ) THEN
    ALTER TABLE haulage_drivers
      ADD CONSTRAINT haulage_drivers_company_user_unique UNIQUE (company_id, user_id);
  END IF;
END $$;

-- Function to generate a random company code
CREATE OR REPLACE FUNCTION generate_company_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i integer;
  code_exists boolean;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;

    SELECT EXISTS(
      SELECT 1 FROM profiles WHERE haulage_company_code = result
    ) INTO code_exists;

    EXIT WHEN NOT code_exists;
  END LOOP;

  RETURN result;
END;
$$;

-- Auto-generate company codes for existing haulage companies that completed onboarding
UPDATE profiles
SET haulage_company_code = generate_company_code()
WHERE role = 'haulage'
  AND haulage_onboarding_completed = true
  AND haulage_company_code IS NULL;

-- Trigger to auto-generate code when haulage onboarding is completed
CREATE OR REPLACE FUNCTION auto_generate_company_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.role = 'haulage'
    AND NEW.haulage_onboarding_completed = true
    AND (OLD.haulage_onboarding_completed IS NULL OR OLD.haulage_onboarding_completed = false)
    AND NEW.haulage_company_code IS NULL
  THEN
    NEW.haulage_company_code := generate_company_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_generate_company_code ON profiles;
CREATE TRIGGER trg_auto_generate_company_code
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_generate_company_code();

-- RPC function for couriers to link themselves to a company via code
CREATE OR REPLACE FUNCTION link_courier_to_company(
  p_company_code text,
  p_courier_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company_id uuid;
  v_company_name text;
  v_courier_name text;
  v_existing_link uuid;
BEGIN
  SELECT id, company_name INTO v_company_id, v_company_name
  FROM profiles
  WHERE haulage_company_code = upper(p_company_code)
    AND role = 'haulage';

  IF v_company_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid company code');
  END IF;

  SELECT id INTO v_existing_link
  FROM haulage_drivers
  WHERE company_id = v_company_id AND user_id = p_courier_user_id;

  IF v_existing_link IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_linked', true,
      'company_name', v_company_name
    );
  END IF;

  SELECT full_name INTO v_courier_name
  FROM profiles
  WHERE id = p_courier_user_id;

  INSERT INTO haulage_drivers (company_id, user_id, full_name, is_active)
  VALUES (v_company_id, p_courier_user_id, COALESCE(v_courier_name, 'Driver'), true);

  RETURN jsonb_build_object(
    'success', true,
    'already_linked', false,
    'company_name', v_company_name
  );
END;
$$;

-- Allow linked drivers to view their own record
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'haulage_drivers' AND policyname = 'Linked drivers can view own record'
  ) THEN
    CREATE POLICY "Linked drivers can view own record"
      ON haulage_drivers
      FOR SELECT
      TO authenticated
      USING (user_id = auth.uid());
  END IF;
END $$;
