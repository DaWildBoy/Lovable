/*
  # Add Performance Index for Conversation Participants

  ## Overview
  This migration adds an index on the conversation_participants table to optimize
  queries when loading user conversations and checking last read timestamps.

  ## Changes Made

  1. **Add Index on user_id**
     - Create index on conversation_participants(user_id)
     - Speeds up queries that fetch all conversations for a specific user
     - Improves performance when calculating unread message badges

  ## Performance Impact
  - Faster lookup of user's conversations
  - Improved responsiveness when navigating to Messages tab
  - Minimal impact on write performance
*/

-- Create index for efficient user conversation lookups
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id 
ON conversation_participants(user_id);