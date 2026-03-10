/*
  # Create Cargo Photos Storage Bucket

  1. New Storage Buckets
    - `cargo-photos`
      - Public bucket for storing cargo item photos
      - Allows authenticated users to upload images
      - Public read access for all users

  2. Security
    - Authenticated users can upload to their own folder (user_id/)
    - Public read access to all images
    - Max file size: 5MB
*/

-- Create the cargo-photos storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'cargo-photos',
  'cargo-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload cargo photos to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own cargo photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own cargo photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view cargo photos" ON storage.objects;

-- Allow authenticated users to upload photos to their own folder
CREATE POLICY "Users can upload cargo photos to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'cargo-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to update their own photos
CREATE POLICY "Users can update own cargo photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'cargo-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'cargo-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated users to delete their own photos
CREATE POLICY "Users can delete own cargo photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'cargo-photos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read access to all cargo photos (since bucket is public)
CREATE POLICY "Public can view cargo photos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'cargo-photos');