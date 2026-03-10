/*
  # Proof of Delivery (POD) System

  1. New Tables
    - `proof_of_delivery`
      - `id` (uuid, primary key)
      - `job_id` (uuid, foreign key to jobs, unique)
      - `required_type` (text: NONE, PHOTO, SIGNATURE, PHOTO_AND_SIGNATURE)
      - `status` (text: NOT_REQUIRED, REQUIRED, PENDING, COMPLETED)
      - `photo_urls` (text array, nullable)
      - `signature_image_url` (text, nullable)
      - `signed_by_name` (text, nullable)
      - `completed_at` (timestamptz, nullable)
      - `completed_by_user_id` (uuid, nullable)
      - `completed_by_profile_type` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Jobs Table Updates
    - Add `proof_of_delivery_required` field to jobs table
      (enum: NONE, PHOTO, SIGNATURE, PHOTO_AND_SIGNATURE)

  3. Storage Buckets
    - `pod-photos` - Private bucket for POD photos
    - `pod-signatures` - Private bucket for signatures

  4. Security (RLS)
    - Enable RLS on proof_of_delivery table
    - Couriers can read/update POD for jobs assigned to them
    - Retail/Customers can read POD for jobs they created
    - Admins can read ALL POD records

  5. Storage Security
    - Couriers can upload to their assigned job's POD folders
    - Retail/Customers can read POD files for their jobs
    - Admins can access ALL POD files
*/

-- Add proof_of_delivery_required field to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'proof_of_delivery_required'
  ) THEN
    ALTER TABLE jobs ADD COLUMN proof_of_delivery_required text DEFAULT 'NONE' NOT NULL;
  END IF;
END $$;

-- Create proof_of_delivery table
CREATE TABLE IF NOT EXISTS proof_of_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid UNIQUE NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  required_type text NOT NULL DEFAULT 'NONE',
  status text NOT NULL DEFAULT 'NOT_REQUIRED',
  photo_urls text[] DEFAULT ARRAY[]::text[],
  signature_image_url text,
  signed_by_name text,
  completed_at timestamptz,
  completed_by_user_id uuid REFERENCES auth.users(id),
  completed_by_profile_type text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE proof_of_delivery ENABLE ROW LEVEL SECURITY;

-- Couriers can read POD for jobs assigned to them
CREATE POLICY "Couriers can read POD for assigned jobs"
  ON proof_of_delivery FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = proof_of_delivery.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Couriers can update POD for jobs assigned to them
CREATE POLICY "Couriers can update POD for assigned jobs"
  ON proof_of_delivery FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = proof_of_delivery.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = proof_of_delivery.job_id
      AND jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Job creators can read POD for their jobs
CREATE POLICY "Job creators can read POD"
  ON proof_of_delivery FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = proof_of_delivery.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Admins can read ALL POD records
CREATE POLICY "Admins can read all POD records"
  ON proof_of_delivery FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Admins can update ALL POD records
CREATE POLICY "Admins can update all POD records"
  ON proof_of_delivery FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- System can insert POD records when jobs are created
CREATE POLICY "System can insert POD records"
  ON proof_of_delivery FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      WHERE jobs.id = proof_of_delivery.job_id
      AND jobs.customer_user_id = auth.uid()
    )
  );

-- Create storage bucket for POD photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pod-photos',
  'pod-photos',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for POD signatures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pod-signatures',
  'pod-signatures',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pod-photos

-- Couriers can upload photos for jobs assigned to them
CREATE POLICY "Couriers can upload POD photos for assigned jobs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pod-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT jobs.id::text
      FROM jobs
      WHERE jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Couriers can read photos for jobs assigned to them
CREATE POLICY "Couriers can read POD photos for assigned jobs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT jobs.id::text
      FROM jobs
      WHERE jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Job creators can read photos for their jobs
CREATE POLICY "Job creators can read POD photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND (storage.foldername(name))[1] IN (
      SELECT jobs.id::text
      FROM jobs
      WHERE jobs.customer_user_id = auth.uid()
    )
  );

-- Admins can read ALL POD photos
CREATE POLICY "Admins can read all POD photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pod-photos'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Storage policies for pod-signatures

-- Couriers can upload signatures for jobs assigned to them (mobile only - enforced in app)
CREATE POLICY "Couriers can upload POD signatures for assigned jobs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'pod-signatures'
    AND (storage.foldername(name))[1] IN (
      SELECT jobs.id::text
      FROM jobs
      WHERE jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Couriers can read signatures for jobs assigned to them
CREATE POLICY "Couriers can read POD signatures for assigned jobs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pod-signatures'
    AND (storage.foldername(name))[1] IN (
      SELECT jobs.id::text
      FROM jobs
      WHERE jobs.assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Job creators can read signatures for their jobs
CREATE POLICY "Job creators can read POD signatures"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pod-signatures'
    AND (storage.foldername(name))[1] IN (
      SELECT jobs.id::text
      FROM jobs
      WHERE jobs.customer_user_id = auth.uid()
    )
  );

-- Admins can read ALL POD signatures
CREATE POLICY "Admins can read all POD signatures"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'pod-signatures'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_proof_of_delivery_job_id ON proof_of_delivery(job_id);
CREATE INDEX IF NOT EXISTS idx_proof_of_delivery_status ON proof_of_delivery(status);

-- Function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_proof_of_delivery_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS proof_of_delivery_updated_at ON proof_of_delivery;
CREATE TRIGGER proof_of_delivery_updated_at
  BEFORE UPDATE ON proof_of_delivery
  FOR EACH ROW
  EXECUTE FUNCTION update_proof_of_delivery_updated_at();