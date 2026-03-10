/*
  # Auto-delete old chat messages after 30 days

  1. Extensions
    - Enable `pg_cron` for scheduled job execution

  2. New Functions
    - `delete_old_chats()` - Removes chat data older than 30 days from:
      - `messages` (conversation messages)
      - `job_messages` (job-specific messages)
      - `support_messages` and `support_sessions` (support chat)
      - `conversations` with no remaining messages (cleanup empty conversations)

  3. Scheduled Jobs
    - Runs `delete_old_chats()` daily at 3:00 AM UTC

  4. Important Notes
    - Messages in `messages` and `job_messages` are deleted based on their `created_at` timestamp
    - Support messages older than 30 days are deleted, and empty resolved sessions are cleaned up
    - Conversations with no remaining messages are automatically removed
    - Cascade deletes handle `conversation_participants` cleanup automatically
    - This runs once daily to minimize database load
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.delete_old_chats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cutoff_date timestamptz := now() - interval '30 days';
BEGIN
  DELETE FROM messages WHERE created_at < cutoff_date;

  DELETE FROM job_messages WHERE created_at < cutoff_date;

  DELETE FROM support_messages WHERE created_at < cutoff_date;

  DELETE FROM support_sessions
  WHERE updated_at < cutoff_date
    AND status = 'resolved'
    AND NOT EXISTS (
      SELECT 1 FROM support_messages sm
      WHERE sm.session_id = support_sessions.id
    );

  DELETE FROM conversations
  WHERE NOT EXISTS (
    SELECT 1 FROM messages m
    WHERE m.conversation_id = conversations.id
  );
END;
$$;

SELECT cron.schedule(
  'delete-old-chats-daily',
  '0 3 * * *',
  $$SELECT public.delete_old_chats()$$
);
