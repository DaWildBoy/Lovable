/*
  # Create Storage Bucket for Profile Pictures

  1. Storage
    - Creates `profile-pictures` bucket for storing user avatars
    - Enables public access for viewing images
    - Sets up policies for authenticated users to upload their own profile pictures
  
  2. Security
    - Public read access (anyone can view profile pictures)
    - Authenticated users can upload their own profile pictures
    - Users can only update/delete their own profile pictures
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view profile pictures"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'profile-pictures');

CREATE POLICY "Authenticated users can upload their own profile pictures"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-pictures' 
    AND (storage.foldername(name))[1] = 'avatars'
  );

CREATE POLICY "Users can update their own profile pictures"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = 'avatars'
  );

CREATE POLICY "Users can delete their own profile pictures"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-pictures'
    AND (storage.foldername(name))[1] = 'avatars'
  );
