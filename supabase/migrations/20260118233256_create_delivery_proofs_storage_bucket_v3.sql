/*
  # Create Delivery Proofs Storage Bucket
  
  ## Overview
  Creates secure storage bucket for delivery proof photos and e-signatures.
  
  ## New Storage Bucket
  1. Bucket: `delivery-proofs`
    - Stores delivery photos and signature images
    - Private bucket (not publicly accessible)
    - Only accessible by courier who created and business who owns the job
  
  ## Security Policies
  2. Upload Policy:
    - Couriers can upload proof files for jobs they're assigned to
    - File path format: {job_id}/{cargo_item_id}/{proof_type}-{timestamp}.{ext}
  
  3. Read Policy:
    - Couriers can view proofs for jobs they're assigned to
    - Business owners can view proofs for their own jobs
  
  ## Important Notes
  - All files are private by default
  - File size limits handled by Supabase (default 50MB)
  - Supported formats: jpg, jpeg, png, webp
  - Files are permanent records for legal/dispute purposes
*/

-- Create the delivery-proofs storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-proofs',
  'delivery-proofs',
  false,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Couriers can upload delivery proofs for assigned jobs" ON storage.objects;
DROP POLICY IF EXISTS "Couriers can view delivery proofs for assigned jobs" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can view delivery proofs for their jobs" ON storage.objects;

-- Policy: Couriers can upload proof files for their assigned jobs
CREATE POLICY "Couriers can upload delivery proofs for assigned jobs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'delivery-proofs' AND
  EXISTS (
    SELECT 1 FROM jobs j
    JOIN couriers c ON c.id = j.assigned_courier_id
    WHERE j.id::text = split_part(name, '/', 1)
    AND c.user_id = auth.uid()
  )
);

-- Policy: Couriers can read proofs for their assigned jobs
CREATE POLICY "Couriers can view delivery proofs for assigned jobs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-proofs' AND
  EXISTS (
    SELECT 1 FROM jobs j
    JOIN couriers c ON c.id = j.assigned_courier_id
    WHERE j.id::text = split_part(name, '/', 1)
    AND c.user_id = auth.uid()
  )
);

-- Policy: Business owners can read proofs for their own jobs
CREATE POLICY "Business owners can view delivery proofs for their jobs"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'delivery-proofs' AND
  EXISTS (
    SELECT 1 FROM jobs
    WHERE jobs.id::text = split_part(name, '/', 1)
    AND jobs.customer_user_id = auth.uid()
  )
);