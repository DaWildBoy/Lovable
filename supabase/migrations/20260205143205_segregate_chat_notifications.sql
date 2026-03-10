/*
  # Segregate Chat Notifications from Global Notifications

  ## Overview
  This migration removes chat message notifications from the global notifications system.
  Chat messages should only appear in the Messages tab with unread badges, not in the 
  Notifications/Alerts tab which is reserved for system alerts (Job updates, Payments, Security).

  ## Changes Made

  1. **Drop Message Notification Trigger**
     - Removes the `trigger_notify_message_participants` trigger
     - This prevents new chat messages from creating notification entries

  2. **Clean Up Existing Message Notifications**
     - Deletes all existing notifications with type='message'
     - This clears out historical chat notifications from the Alerts tab

  ## Result
  - Chat messages will only show up in the Messages tab with unread badges
  - The Notifications/Alerts tab will only show system-level notifications
  - Unread message counts continue to work via conversation_participants.last_read_at
*/

-- Drop the trigger that creates notifications for messages
DROP TRIGGER IF EXISTS trigger_notify_message_participants ON messages;

-- Drop the function as well since it's no longer needed
DROP FUNCTION IF EXISTS notify_message_participants();

-- Clean up existing message notifications from the notifications table
DELETE FROM notifications WHERE type = 'message';