/*
  # Add Performance Index for Message Queries

  ## Overview
  This migration adds a composite index on the messages table to optimize unread message
  count queries. The index covers conversation_id and created_at, which are frequently
  used together when calculating unread message badges.

  ## Changes Made

  1. **Add Composite Index**
     - Create index on messages(conversation_id, created_at)
     - This speeds up queries that filter by conversation and compare timestamps
     - Significantly improves performance when counting unread messages across multiple conversations

  ## Performance Impact
  - Reduces query time for unread message counts from O(n) to O(log n)
  - Improves responsiveness of message badge updates
  - No impact on write performance as messages are not high-frequency writes
*/

-- Create composite index for efficient unread message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created 
ON messages(conversation_id, created_at DESC);