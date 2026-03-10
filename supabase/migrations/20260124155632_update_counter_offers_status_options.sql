/*
  # Update Counter Offers Status Options

  1. Changes
    - Add 'countered' status to counter_offers to track when an offer has been countered
    - This allows us to show "Pending Counter Offer" in the UI

  2. Purpose
    - When a customer counters a courier's offer, the courier's offer is marked as 'countered'
    - This helps track the negotiation flow and show appropriate status messages
*/

-- Drop the existing check constraint and add a new one with 'countered' status
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE counter_offers DROP CONSTRAINT IF EXISTS counter_offers_status_check;
  
  -- Add new constraint with 'countered' status
  ALTER TABLE counter_offers ADD CONSTRAINT counter_offers_status_check 
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'countered'));
END $$;
