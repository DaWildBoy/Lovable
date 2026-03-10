/*
  # Add Notification Update Policy

  ## Overview
  Adds RLS policy to allow users to update (mark as read/delete) their own notifications.
  This is required for the mark-as-read functionality in the notifications pages.

  ## Changes
  - Add UPDATE policy for notifications table
  - Allow users to update their own notifications

  ## Security
  - Users can only update notifications where user_id matches their auth.uid()
  - Haulage companies can update company notifications
*/

-- Add UPDATE policy for notifications
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    -- Haulage company users can update company notifications
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'business'
        AND profiles.business_type = 'haulage'
        AND (
          notifications.user_id = profiles.id
          OR (notifications.data->>'company_id')::uuid = profiles.id
        )
    )
  );
