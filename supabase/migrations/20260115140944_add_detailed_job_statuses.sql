/*
  # Add Detailed Job Status Workflow
  
  1. Changes
    - Update job status enum to include granular workflow stages:
      - 'on_way_to_pickup' - Courier is heading to pickup location
      - 'cargo_collected' - Cargo has been picked up
      - 'in_transit' - Cargo is being delivered
      - 'delivered' - Cargo has been delivered (awaiting proof)
    - These stages enable real-time tracking and notifications
    
  2. Notes
    - Existing statuses (draft, open, bidding, assigned, in_progress, completed, cancelled) remain unchanged
    - New statuses fit into the workflow between 'assigned' and 'completed'
*/

DO $$ 
BEGIN
  -- Drop the existing constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'jobs' AND constraint_name = 'jobs_status_check'
  ) THEN
    ALTER TABLE jobs DROP CONSTRAINT jobs_status_check;
  END IF;
  
  -- Add new constraint with expanded status options
  ALTER TABLE jobs ADD CONSTRAINT jobs_status_check 
    CHECK (status = ANY (ARRAY[
      'draft'::text, 
      'open'::text, 
      'bidding'::text, 
      'assigned'::text, 
      'on_way_to_pickup'::text,
      'cargo_collected'::text,
      'in_transit'::text,
      'delivered'::text,
      'in_progress'::text,
      'completed'::text, 
      'cancelled'::text
    ]));
END $$;