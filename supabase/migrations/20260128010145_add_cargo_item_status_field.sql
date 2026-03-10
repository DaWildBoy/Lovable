/*
  # Add Status Field to Cargo Items
  
  1. Changes to `cargo_items` table
    - Add `status` field (enum: 'pending', 'delivered')
    - Defaults to 'pending' for new items
    - Automatically set to 'delivered' when delivered_at is set
  
  2. Backfill existing data
    - Set status to 'delivered' where delivered_at is not null
    - Set status to 'pending' where delivered_at is null
  
  3. Trigger
    - Auto-update status to 'delivered' when delivered_at is set
    - Auto-update status to 'pending' when delivered_at is cleared
*/

-- Add status field to cargo_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'status'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN status text DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'delivered'));
  END IF;
END $$;

-- Backfill existing data
UPDATE cargo_items
SET status = CASE
  WHEN delivered_at IS NOT NULL THEN 'delivered'
  ELSE 'pending'
END
WHERE status != CASE
  WHEN delivered_at IS NOT NULL THEN 'delivered'
  ELSE 'pending'
END;

-- Create function to auto-update cargo_item status based on delivered_at
CREATE OR REPLACE FUNCTION update_cargo_item_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.delivered_at IS NOT NULL AND (OLD.delivered_at IS NULL OR OLD.delivered_at != NEW.delivered_at) THEN
    NEW.status = 'delivered';
  ELSIF NEW.delivered_at IS NULL AND OLD.delivered_at IS NOT NULL THEN
    NEW.status = 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update status
DROP TRIGGER IF EXISTS cargo_item_status_trigger ON cargo_items;
CREATE TRIGGER cargo_item_status_trigger
  BEFORE UPDATE ON cargo_items
  FOR EACH ROW
  EXECUTE FUNCTION update_cargo_item_status();

-- Add helpful comment
COMMENT ON COLUMN cargo_items.status IS 'Delivery status of the cargo item: pending (not yet delivered) or delivered (completed)';