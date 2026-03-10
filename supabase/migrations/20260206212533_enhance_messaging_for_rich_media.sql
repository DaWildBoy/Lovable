/*
  # Enhanced Messaging System for Rich Media Support

  1. Modified Tables
    - `messages`
      - `attachment_metadata` (jsonb) - stores thumbnail URLs, file sizes, durations, dimensions, lat/lng for locations
      - `reply_to_message_id` (uuid, nullable) - references parent message for threaded replies
      - `is_deleted` (boolean) - soft delete flag so messages are preserved as evidence

  2. Important Notes
    - Existing messages are not affected (all new columns are nullable or have defaults)
    - attachment_type now supports: 'image', 'audio', 'video', 'location', 'document'
    - Location messages store lat/lng in attachment_metadata instead of embedding in content
    - is_deleted defaults to false so existing messages remain visible
    - reply_to_message_id enables reply-to-message threading
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'attachment_metadata'
  ) THEN
    ALTER TABLE messages ADD COLUMN attachment_metadata jsonb DEFAULT '{}';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'reply_to_message_id'
  ) THEN
    ALTER TABLE messages ADD COLUMN reply_to_message_id uuid REFERENCES messages(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'messages' AND column_name = 'is_deleted'
  ) THEN
    ALTER TABLE messages ADD COLUMN is_deleted boolean DEFAULT false NOT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to ON messages(reply_to_message_id) WHERE reply_to_message_id IS NOT NULL;
