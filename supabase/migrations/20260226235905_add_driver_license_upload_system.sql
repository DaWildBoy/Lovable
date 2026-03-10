/*
  # Add Driver License Upload System

  1. New Storage
    - `driver-id-documents` private storage bucket for driver license photos/scans
  
  2. Modified Tables
    - `haulage_drivers`
      - `license_front_url` (text) - Storage path to front of driver's license
      - `license_back_url` (text) - Storage path to back of driver's license
      - `license_upload_status` (text) - Upload status: 'pending', 'approved', 'rejected'
      - `license_rejection_reason` (text) - Reason if license was rejected (e.g., blurry photo)

  3. Security
    - Storage RLS: drivers can upload their own documents
    - Storage RLS: company owners can view documents for their linked drivers
    - Storage RLS: admin/super_admin can view all documents

  4. Notes
    - License upload is required during the company driver sign-up flow
    - Company owners review the license during the approval step
    - Admins can view licenses when inspecting a company's driver roster
*/

-- Create the storage bucket for driver ID documents (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-id-documents', 'driver-id-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Add license columns to haulage_drivers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'haulage_drivers' AND column_name = 'license_front_url'
  ) THEN
    ALTER TABLE haulage_drivers ADD COLUMN license_front_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'haulage_drivers' AND column_name = 'license_back_url'
  ) THEN
    ALTER TABLE haulage_drivers ADD COLUMN license_back_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'haulage_drivers' AND column_name = 'license_upload_status'
  ) THEN
    ALTER TABLE haulage_drivers ADD COLUMN license_upload_status text DEFAULT 'pending';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'haulage_drivers' AND column_name = 'license_rejection_reason'
  ) THEN
    ALTER TABLE haulage_drivers ADD COLUMN license_rejection_reason text;
  END IF;
END $$;

-- Storage policies for driver-id-documents bucket

-- Drivers can upload their own license documents
CREATE POLICY "Drivers can upload own license documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'driver-id-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Drivers can view their own license documents
CREATE POLICY "Drivers can view own license documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-id-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Drivers can update (re-upload) their own license documents
CREATE POLICY "Drivers can update own license documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'driver-id-documents'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Company owners can view license documents for their linked drivers
CREATE POLICY "Company owners can view driver license documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-id-documents'
  AND EXISTS (
    SELECT 1 FROM haulage_drivers hd
    WHERE hd.company_id = auth.uid()
      AND hd.user_id::text = (storage.foldername(name))[1]
  )
);

-- Admins can view all driver license documents
CREATE POLICY "Admins can view all driver license documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'driver-id-documents'
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  )
);
