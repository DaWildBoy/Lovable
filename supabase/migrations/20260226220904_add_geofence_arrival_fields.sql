/*
  # Add Geofence Arrival Fields to Delivery Stops

  1. Modified Tables
    - `delivery_stops`
      - `arrived_lat` (double precision) - GPS latitude when driver marked arrived
      - `arrived_lng` (double precision) - GPS longitude when driver marked arrived
      - `bad_pin_override` (boolean) - True if driver overrode geofence due to bad customer pin
      - `bad_pin_photo_url` (text) - Photo URL proving driver is at correct location during override
      - `offline_arrival` (boolean) - True if arrival was recorded while device was offline
      - `offline_arrival_synced_at` (timestamptz) - When the offline arrival was synced to server

  2. Security
    - Existing RLS policies on delivery_stops already cover these new columns
    - No new policies needed as the table-level policies apply to all columns

  3. Notes
    - These fields support the geofence validation system for fair detention timing
    - bad_pin_override flags allow admin review of disputed arrival locations
    - offline_arrival tracking ensures drivers are not penalized for poor connectivity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_stops' AND column_name = 'arrived_lat'
  ) THEN
    ALTER TABLE delivery_stops ADD COLUMN arrived_lat double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_stops' AND column_name = 'arrived_lng'
  ) THEN
    ALTER TABLE delivery_stops ADD COLUMN arrived_lng double precision;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_stops' AND column_name = 'bad_pin_override'
  ) THEN
    ALTER TABLE delivery_stops ADD COLUMN bad_pin_override boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_stops' AND column_name = 'bad_pin_photo_url'
  ) THEN
    ALTER TABLE delivery_stops ADD COLUMN bad_pin_photo_url text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_stops' AND column_name = 'offline_arrival'
  ) THEN
    ALTER TABLE delivery_stops ADD COLUMN offline_arrival boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'delivery_stops' AND column_name = 'offline_arrival_synced_at'
  ) THEN
    ALTER TABLE delivery_stops ADD COLUMN offline_arrival_synced_at timestamptz;
  END IF;
END $$;
