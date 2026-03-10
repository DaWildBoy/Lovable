-- BACKHAUL MATCHING TEST DATA
-- This script creates test data to demonstrate the backhaul matching feature
-- Run these queries in your Supabase SQL editor to test the feature

-- =====================================================
-- STEP 1: Set courier's home base to Port of Spain
-- =====================================================
-- Replace 'YOUR_COURIER_USER_ID' with an actual courier user ID from your profiles table
-- You can find this by running: SELECT id, email, role FROM profiles WHERE role = 'courier' LIMIT 1;

UPDATE profiles
SET
  home_base_location_text = 'Port of Spain, Trinidad and Tobago',
  home_base_lat = 10.6596,
  home_base_lng = -61.5189
WHERE role = 'courier'
  AND id = 'YOUR_COURIER_USER_ID'; -- Replace with actual courier ID

-- =====================================================
-- STEP 2: Create an active job with dropoff in San Fernando
-- =====================================================
-- This simulates a courier currently delivering to San Fernando
-- Replace 'YOUR_COURIER_USER_ID' and 'YOUR_CUSTOMER_USER_ID' with actual IDs

-- First, let's create a test customer if needed (optional)
-- INSERT INTO profiles (id, role, full_name, email)
-- VALUES ('test-customer-uuid', 'customer', 'Test Customer', 'test@example.com');

-- Create a job that's currently active (assigned status)
INSERT INTO jobs (
  id,
  user_id,  -- Customer who created the job
  pickup_location_text,
  pickup_lat,
  pickup_lng,
  dropoff_location_text,
  dropoff_lat,
  dropoff_lng,
  customer_offer_ttd,
  cargo_size_category,
  delivery_timing,
  status,
  courier_id,
  created_at
) VALUES (
  gen_random_uuid(),
  'YOUR_CUSTOMER_USER_ID',  -- Replace with actual customer ID
  'Chaguanas, Trinidad',
  10.5167,
  -61.4167,
  'San Fernando, Trinidad',  -- This is the current dropoff location
  10.2797,
  -61.4650,
  250,
  'medium',
  'immediate',
  'assigned',  -- Active job
  'YOUR_COURIER_USER_ID',  -- Replace with actual courier ID
  NOW()
);

-- =====================================================
-- STEP 3: Create a backhaul opportunity job
-- =====================================================
-- This job goes from San Fernando (near current dropoff) to Port of Spain (near home)
-- This should trigger the "Return Trip Detected" alert

INSERT INTO jobs (
  id,
  user_id,  -- Another customer
  pickup_location_text,
  pickup_lat,
  pickup_lng,
  dropoff_location_text,
  dropoff_lat,
  dropoff_lng,
  customer_offer_ttd,
  cargo_size_category,
  delivery_timing,
  status,
  created_at
) VALUES (
  gen_random_uuid(),
  'YOUR_CUSTOMER_USER_ID',  -- Replace with actual customer ID
  'San Fernando, Trinidad and Tobago',  -- Near current dropoff (within 10km)
  10.2797,
  -61.4650,
  'Port of Spain, Trinidad and Tobago',  -- Near home base (within 10km)
  10.6596,
  -61.5189,
  350,  -- Good price for the trip
  'medium',
  'immediate',
  'open',  -- Available job
  NOW()
);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check courier's home base is set
SELECT
  id,
  email,
  role,
  home_base_location_text,
  home_base_lat,
  home_base_lng
FROM profiles
WHERE role = 'courier'
  AND home_base_location_text IS NOT NULL;

-- Check active jobs for the courier
SELECT
  id,
  pickup_location_text,
  dropoff_location_text,
  status,
  courier_id
FROM jobs
WHERE status = 'assigned'
  AND courier_id IS NOT NULL;

-- Check available jobs (backhaul opportunities)
SELECT
  id,
  pickup_location_text,
  dropoff_location_text,
  customer_offer_ttd,
  status
FROM jobs
WHERE status = 'open';

-- =====================================================
-- ADDITIONAL TEST SCENARIOS
-- =====================================================

-- Create more backhaul opportunities for different routes

-- Chaguanas to Port of Spain
INSERT INTO jobs (
  id, user_id, pickup_location_text, pickup_lat, pickup_lng,
  dropoff_location_text, dropoff_lat, dropoff_lng,
  customer_offer_ttd, cargo_size_category, delivery_timing, status, created_at
) VALUES (
  gen_random_uuid(), 'YOUR_CUSTOMER_USER_ID',
  'Chaguanas, Trinidad', 10.5167, -61.4167,
  'Port of Spain, Trinidad', 10.6596, -61.5189,
  280, 'small', 'immediate', 'open', NOW()
);

-- Arima to Port of Spain
INSERT INTO jobs (
  id, user_id, pickup_location_text, pickup_lat, pickup_lng,
  dropoff_location_text, dropoff_lat, dropoff_lng,
  customer_offer_ttd, cargo_size_category, delivery_timing, status, created_at
) VALUES (
  gen_random_uuid(), 'YOUR_CUSTOMER_USER_ID',
  'Arima, Trinidad', 10.6386, -61.2819,
  'Port of Spain, Trinidad', 10.6596, -61.5189,
  300, 'medium', 'immediate', 'open', NOW()
);

-- =====================================================
-- CLEANUP (Run this to remove test data)
-- =====================================================

-- Uncomment to remove test jobs
-- DELETE FROM jobs WHERE pickup_location_text LIKE '%San Fernando%' AND status = 'open';
-- DELETE FROM jobs WHERE pickup_location_text LIKE '%Chaguanas%' AND status = 'open';
-- DELETE FROM jobs WHERE pickup_location_text LIKE '%Arima%' AND status = 'open';

-- Uncomment to reset courier home base
-- UPDATE profiles SET home_base_location_text = NULL, home_base_lat = NULL, home_base_lng = NULL WHERE role = 'courier';
