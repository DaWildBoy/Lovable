/*
  # Enable Realtime on Driver Location Tracking Table

  1. Changes
    - Adds `job_driver_location_current` table to the Supabase Realtime publication
    - This enables WebSocket subscriptions for live GPS coordinate changes
    - Eliminates the need for HTTP polling, reducing server load

  2. Important Notes
    - This is required for the Live GPS Map Tracking feature
    - Customers and retailers subscribe to location changes via Realtime
    - Only the specific job_id row is streamed to each subscriber via RLS
*/

ALTER PUBLICATION supabase_realtime ADD TABLE job_driver_location_current;
