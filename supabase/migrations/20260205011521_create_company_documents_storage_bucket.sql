/*
  # Create Storage Bucket for Company Documents

  1. Storage
    - Creates `company-documents` bucket for storing business documents
    - Includes certificates of incorporation and liability insurance
    - Public read access for verified documents
    - Secure upload policies for company owners
  
  2. Security
    - Public read access (for transparency and verification)
    - Authenticated companies can upload their own documents
    - Companies can only update/delete their own documents
    - Documents organized by company ID in folder structure
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('company-documents', 'company-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view company documents"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'company-documents');

CREATE POLICY "Companies can upload their own documents"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'company-documents' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Companies can update their own documents"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'company-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Companies can delete their own documents"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'company-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
