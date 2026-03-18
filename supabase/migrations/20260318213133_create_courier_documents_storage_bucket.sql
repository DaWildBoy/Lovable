/*
  # Create courier-documents storage bucket

  1. New Storage Bucket
    - `courier-documents` (private) - stores courier verification documents
      (driver's license, vehicle registration, insurance)

  2. Security
    - Bucket is private (not publicly accessible)
    - RLS policies allow authenticated users to upload their own documents
    - RLS policies allow authenticated users to read their own documents
    - RLS policies allow authenticated users to update/delete their own documents

  3. Important Notes
    - This bucket was missing and caused "Bucket not found" errors during courier onboarding
    - Files are stored under user-id prefixed paths for isolation
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('courier-documents', 'courier-documents', false)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Couriers can upload own documents'
    AND tablename = 'objects'
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Couriers can upload own documents"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'courier-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Couriers can view own documents'
    AND tablename = 'objects'
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Couriers can view own documents"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'courier-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Couriers can update own documents'
    AND tablename = 'objects'
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Couriers can update own documents"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'courier-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'courier-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE policyname = 'Couriers can delete own documents'
    AND tablename = 'objects'
    AND schemaname = 'storage'
  ) THEN
    CREATE POLICY "Couriers can delete own documents"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'courier-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;