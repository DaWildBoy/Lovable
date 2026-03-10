/*
  # Add Delete Policy to Notifications

  ## Changes
    - Add DELETE policy to allow users to delete their own notifications
    
  ## Security
    - Users can only delete their own notifications
    - Policy checks that auth.uid() matches the notification's user_id
*/

-- Add delete policy for notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
