/*
  # Add Multi-Stop Delivery Support

  1. Changes to `jobs` table
    - Add `is_multi_stop` boolean to indicate multi-stop deliveries
    - Add `has_multiple_pickups` boolean to allow multiple pickup locations
    - Add `pickups` jsonb array to store multiple pickup locations
    - Add `dropoffs` jsonb array to store multiple dropoff locations with order
    - Add `total_distance_km` to store calculated multi-stop distance
    - Add `eta_minutes` for estimated time for multi-stop routes
    
  2. Changes to `cargo_items` table
    - Add `assigned_stop_index` to assign cargo to specific dropoff stop
    - Add `assigned_stop_id` as a unique identifier for the stop assignment
    
  3. Data Structure
    - pickups: [{ id: string, address: string, lat: number, lng: number, label?: string }]
    - dropoffs: [{ id: string, address: string, lat: number, lng: number, label?: string, orderIndex: number }]
    
  4. Backward Compatibility
    - Existing fields (pickup_location_text, dropoff_location_text, etc.) remain for single-stop jobs
    - is_multi_stop defaults to false
*/

-- Add multi-stop fields to jobs table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'is_multi_stop'
  ) THEN
    ALTER TABLE jobs ADD COLUMN is_multi_stop BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'has_multiple_pickups'
  ) THEN
    ALTER TABLE jobs ADD COLUMN has_multiple_pickups BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'pickups'
  ) THEN
    ALTER TABLE jobs ADD COLUMN pickups JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'dropoffs'
  ) THEN
    ALTER TABLE jobs ADD COLUMN dropoffs JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'total_distance_km'
  ) THEN
    ALTER TABLE jobs ADD COLUMN total_distance_km DECIMAL(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'jobs' AND column_name = 'eta_minutes'
  ) THEN
    ALTER TABLE jobs ADD COLUMN eta_minutes INTEGER;
  END IF;
END $$;

-- Add stop assignment fields to cargo_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'assigned_stop_index'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN assigned_stop_index INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cargo_items' AND column_name = 'assigned_stop_id'
  ) THEN
    ALTER TABLE cargo_items ADD COLUMN assigned_stop_id TEXT;
  END IF;
END $$;

-- Add helpful comments
COMMENT ON COLUMN jobs.is_multi_stop IS 'Indicates if this is a multi-stop delivery route';
COMMENT ON COLUMN jobs.has_multiple_pickups IS 'Indicates if the route has multiple pickup locations';
COMMENT ON COLUMN jobs.pickups IS 'Array of pickup location objects: [{ id, address, lat, lng, label }]';
COMMENT ON COLUMN jobs.dropoffs IS 'Array of dropoff location objects: [{ id, address, lat, lng, label, orderIndex }]';
COMMENT ON COLUMN jobs.total_distance_km IS 'Total distance for multi-stop routes calculated from all stops';
COMMENT ON COLUMN jobs.eta_minutes IS 'Estimated time in minutes for the entire multi-stop route';
COMMENT ON COLUMN cargo_items.assigned_stop_index IS 'The index of the dropoff stop this cargo is assigned to (0-based)';
COMMENT ON COLUMN cargo_items.assigned_stop_id IS 'The unique ID of the dropoff stop this cargo is assigned to';