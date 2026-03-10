/*
  # Add Job Reference IDs and Super Admin Role

  1. Changes to `jobs` table
    - `job_reference_id` (text, unique) - Human-readable job ID like MOV-0001
    - Auto-generated via sequence for new jobs
    - Backfills existing jobs with sequential IDs

  2. Changes to `profiles` table  
    - Updates role check constraint to allow 'super_admin' role
    - Sets dylan@movemett.com to super_admin

  3. New sequence
    - `job_reference_seq` - auto-incrementing sequence for job IDs

  4. New trigger
    - `set_job_reference_id` - auto-assigns reference ID on insert
*/

-- Create sequence for job reference IDs
CREATE SEQUENCE IF NOT EXISTS job_reference_seq START WITH 1001;

-- Add job_reference_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'job_reference_id'
  ) THEN
    ALTER TABLE jobs ADD COLUMN job_reference_id text UNIQUE;
  END IF;
END $$;

-- Backfill existing jobs with reference IDs ordered by creation date
DO $$
DECLARE
  job_rec RECORD;
  counter INT := 1;
BEGIN
  FOR job_rec IN 
    SELECT id FROM jobs WHERE job_reference_id IS NULL ORDER BY created_at ASC
  LOOP
    UPDATE jobs SET job_reference_id = 'MOV-' || LPAD(counter::text, 4, '0') WHERE id = job_rec.id;
    counter := counter + 1;
  END LOOP;
  IF counter > 1 THEN
    PERFORM setval('job_reference_seq', 1000 + counter - 1);
  END IF;
END $$;

-- Create function to auto-assign job reference ID
CREATE OR REPLACE FUNCTION set_job_reference_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_reference_id IS NULL THEN
    NEW.job_reference_id := 'MOV-' || LPAD(nextval('job_reference_seq')::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_set_job_reference_id ON jobs;
CREATE TRIGGER trigger_set_job_reference_id
  BEFORE INSERT ON jobs
  FOR EACH ROW
  EXECUTE FUNCTION set_job_reference_id();

-- Update role check constraint to include super_admin
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role = ANY (ARRAY['customer','courier','business','admin','super_admin']));

-- Update dylan@movemett.com to super_admin role
UPDATE profiles SET role = 'super_admin' WHERE email = 'dylan@movemett.com';

-- Add RLS policy so super_admins can read all profiles
CREATE POLICY "Super admins can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Add RLS policy so super_admins can update all profiles
CREATE POLICY "Super admins can update all profiles"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all jobs
CREATE POLICY "Super admins can view all jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all conversations
CREATE POLICY "Super admins can view all conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all messages
CREATE POLICY "Super admins can view all messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all couriers
CREATE POLICY "Super admins can view all couriers"
  ON couriers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can update all couriers
CREATE POLICY "Super admins can update all couriers"
  ON couriers FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all notifications
CREATE POLICY "Super admins can view all notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all business subscriptions
CREATE POLICY "Super admins can view all business subscriptions"
  ON business_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can update all business subscriptions
CREATE POLICY "Super admins can update all business subscriptions"
  ON business_subscriptions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all cargo items
CREATE POLICY "Super admins can view all cargo items"
  ON cargo_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all delivery stops
CREATE POLICY "Super admins can view all delivery stops"
  ON delivery_stops FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all conversation participants
CREATE POLICY "Super admins can view all conversation participants"
  ON conversation_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all counter offers
CREATE POLICY "Super admins can view all counter offers"
  ON counter_offers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all provider ratings
CREATE POLICY "Super admins can view all provider ratings"
  ON provider_ratings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all haulage drivers
CREATE POLICY "Super admins can view all haulage drivers"
  ON haulage_drivers FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all haulage vehicles
CREATE POLICY "Super admins can view all haulage vehicles"
  ON haulage_vehicles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all proof of delivery
CREATE POLICY "Super admins can view all proof of delivery"
  ON proof_of_delivery FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can view all saved locations
CREATE POLICY "Super admins can view all saved locations"
  ON saved_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );

-- Super admin can update all jobs
CREATE POLICY "Super admins can update all jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'
    )
  );
