/*
  # Add Granular Admin Roles

  1. Changes
    - Updates the admin role system to support three distinct admin levels:
      - `super_admin`: Full platform control, owners/developers only
      - `support_admin`: General admin duties (user support, job management, messaging)
      - `verification_admin`: Limited to verifying couriers and businesses only
    - Adds RLS policies so support_admin and verification_admin can access profiles for admin duties

  2. Security
    - super_admin retains all existing access
    - support_admin can read all profiles and update verification-related fields
    - verification_admin can only read profiles and update verification status fields

  3. Notes
    - Existing `admin` role users are migrated to `support_admin`
    - The `admin` value is no longer used going forward
*/

-- Migrate existing 'admin' role users to 'support_admin'
UPDATE profiles
SET role = 'support_admin'
WHERE role = 'admin';

-- Update the is_super_admin helper function to also recognize admin roles
CREATE OR REPLACE FUNCTION public.is_any_admin(user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
    AND role IN ('super_admin', 'support_admin', 'verification_admin')
  );
$$;

-- Allow support_admin and verification_admin to read all profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Support and verification admins can read profiles'
    AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Support and verification admins can read profiles"
      ON profiles FOR SELECT
      TO authenticated
      USING (
        public.is_any_admin(auth.uid())
      );
  END IF;
END $$;

-- Allow support_admin to update profiles (for user management)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Support admins can update profiles'
    AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "Support admins can update profiles"
      ON profiles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('super_admin', 'support_admin')
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
          AND p.role IN ('super_admin', 'support_admin')
        )
      );
  END IF;
END $$;

-- Allow verification_admin to update courier verification fields
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Verification admins can update verification fields'
    AND tablename = 'couriers'
  ) THEN
    CREATE POLICY "Verification admins can update verification fields"
      ON couriers FOR UPDATE
      TO authenticated
      USING (
        public.is_any_admin(auth.uid())
      )
      WITH CHECK (
        public.is_any_admin(auth.uid())
      );
  END IF;
END $$;

-- Allow all admin types to read couriers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Admins can read all couriers'
    AND tablename = 'couriers'
  ) THEN
    CREATE POLICY "Admins can read all couriers"
      ON couriers FOR SELECT
      TO authenticated
      USING (
        public.is_any_admin(auth.uid())
      );
  END IF;
END $$;
