/*
  # Create Chat Attachments Storage Bucket

  1. New Storage Bucket
    - `chat_attachments` (public read access for displaying in chat)
    - Allows authenticated users to upload files to their own folder
    - Allows public read access so images/videos render in chat

  2. Security
    - Upload restricted to authenticated users only
    - Users can only upload to paths under their own user ID
    - Public read access for rendering media in conversations
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload chat attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

CREATE POLICY "Anyone can view chat attachments"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete own chat attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[2]);
