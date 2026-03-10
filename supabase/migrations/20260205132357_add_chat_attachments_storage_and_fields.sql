/*
  # Add Chat Attachments Support

  1. Storage
    - Create `chat_attachments` storage bucket for photos/media shared in chats
    - Set up RLS policies for secure access

  2. Changes to Messages Table
    - Add `attachment_url` field to store file URLs
    - Add `attachment_type` field to specify media type (image, video, etc.)

  3. Security
    - Users can upload attachments to their own conversations
    - Users can view attachments in conversations they're part of
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat_attachments', 'chat_attachments', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload attachments to their conversations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat_attachments' AND
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.user_id = auth.uid()
    AND cp.conversation_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can view attachments in their conversations"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat_attachments' AND
  EXISTS (
    SELECT 1 FROM conversation_participants cp
    WHERE cp.user_id = auth.uid()
    AND cp.conversation_id::text = (storage.foldername(name))[1]
  )
);

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat_attachments' AND
  (storage.foldername(name))[2] = auth.uid()::text
);

ALTER TABLE messages
ADD COLUMN IF NOT EXISTS attachment_url text,
ADD COLUMN IF NOT EXISTS attachment_type text;
