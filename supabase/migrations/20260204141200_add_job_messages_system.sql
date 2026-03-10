/*
  # Job Messages System

  1. New Tables
    - `job_messages`
      - `id` (uuid, primary key)
      - `job_id` (uuid, foreign key to jobs)
      - `sender_id` (uuid, foreign key to auth.users)
      - `content` (text, message content)
      - `media_url` (text, optional image/video URL)
      - `media_type` (text, 'image' or 'video')
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `job_messages` table
    - Add policy for users to view messages on jobs they're involved in
    - Add policy for users to send messages on jobs they're involved in
    - Users can view/send if they are:
      - Job creator (customer_user_id)
      - Assigned courier (assigned_courier_id)
      - Assigned company (assigned_company_id)

  3. Storage
    - Create `chat-media` bucket for message attachments
    - Public read access for media files
    - Authenticated users can upload media
*/

-- 1. Create job_messages table
CREATE TABLE IF NOT EXISTS job_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_job_messages_job_id ON job_messages(job_id);
CREATE INDEX IF NOT EXISTS idx_job_messages_created_at ON job_messages(created_at DESC);

-- 3. Enable RLS
ALTER TABLE job_messages ENABLE ROW LEVEL SECURITY;

-- 4. Policy: Users can view messages for jobs they're involved in
CREATE POLICY "Users can view messages for their jobs"
  ON job_messages
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = job_messages.job_id
      AND (
        jobs.customer_user_id = auth.uid() 
        OR jobs.assigned_courier_id = auth.uid() 
        OR jobs.assigned_company_id = auth.uid()
      )
    )
  );

-- 5. Policy: Users can send messages for jobs they're involved in
CREATE POLICY "Users can send messages for their jobs"
  ON job_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM jobs 
      WHERE jobs.id = job_messages.job_id
      AND (
        jobs.customer_user_id = auth.uid() 
        OR jobs.assigned_courier_id = auth.uid() 
        OR jobs.assigned_company_id = auth.uid()
      )
    )
  );

-- 6. Storage bucket for chat media
INSERT INTO storage.buckets (id, name, public) 
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage policies for chat media
CREATE POLICY "Authenticated users can upload chat media"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'chat-media');

CREATE POLICY "Public read access for chat media"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'chat-media');

CREATE POLICY "Users can delete their own chat media"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'chat-media' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );