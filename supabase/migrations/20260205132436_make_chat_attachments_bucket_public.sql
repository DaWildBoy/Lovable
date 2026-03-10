/*
  # Make Chat Attachments Bucket Public

  1. Changes
    - Update chat_attachments bucket to be public
    - This allows authenticated users to view images via direct URLs
    - RLS policies still control who can upload and delete
*/

UPDATE storage.buckets
SET public = true
WHERE id = 'chat_attachments';
