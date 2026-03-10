-- Common Admin SQL Queries for MoveMe TT
-- Run these in Supabase SQL Editor as needed

-- ============================================
-- USER MANAGEMENT
-- ============================================

-- Make a user an admin
UPDATE profiles
SET role = 'admin'
WHERE email = 'user@example.com';

-- View all users by role
SELECT
  p.id,
  p.email,
  p.role,
  p.full_name,
  p.phone,
  p.created_at
FROM profiles p
ORDER BY p.created_at DESC;

-- Count users by role
SELECT
  role,
  COUNT(*) as count
FROM profiles
GROUP BY role;

-- ============================================
-- COURIER MANAGEMENT
-- ============================================

-- View all pending courier applications
SELECT
  c.id,
  c.user_id,
  c.verification_status,
  c.vehicle_type,
  c.vehicle_make,
  c.vehicle_model,
  p.full_name,
  p.email,
  p.phone,
  c.created_at
FROM couriers c
JOIN profiles p ON c.user_id = p.id
WHERE c.verification_status = 'pending'
ORDER BY c.created_at DESC;

-- Manually approve a courier
UPDATE couriers
SET verification_status = 'approved',
    verified = true,
    updated_at = NOW()
WHERE user_id = 'user-uuid-here';

-- Manually reject a courier
UPDATE couriers
SET verification_status = 'rejected',
    verified = false,
    updated_at = NOW()
WHERE user_id = 'user-uuid-here';

-- View courier documents
SELECT
  cd.id,
  cd.doc_type,
  cd.file_path,
  cd.status,
  c.user_id,
  p.full_name,
  p.email
FROM courier_documents cd
JOIN couriers c ON cd.courier_id = c.id
JOIN profiles p ON c.user_id = p.id
WHERE cd.status = 'pending'
ORDER BY cd.created_at DESC;

-- Count couriers by verification status
SELECT
  verification_status,
  COUNT(*) as count
FROM couriers
GROUP BY verification_status;

-- ============================================
-- JOB MANAGEMENT
-- ============================================

-- View all active jobs
SELECT
  j.id,
  j.status,
  j.pickup_location_text,
  j.dropoff_location_text,
  j.customer_offer_ttd,
  j.distance_km,
  p.full_name as customer_name,
  p.email as customer_email,
  j.created_at
FROM jobs j
JOIN profiles p ON j.customer_user_id = p.id
WHERE j.status IN ('open', 'bidding', 'assigned', 'in_progress')
ORDER BY j.created_at DESC;

-- View completed jobs
SELECT
  j.id,
  j.customer_offer_ttd,
  j.distance_km,
  p.full_name as customer_name,
  c.vehicle_type,
  cp.full_name as courier_name,
  j.created_at
FROM jobs j
JOIN profiles p ON j.customer_user_id = p.id
LEFT JOIN couriers c ON j.assigned_courier_id = c.id
LEFT JOIN profiles cp ON c.user_id = cp.id
WHERE j.status = 'completed'
ORDER BY j.created_at DESC
LIMIT 100;

-- Jobs statistics
SELECT
  status,
  COUNT(*) as count,
  AVG(customer_offer_ttd) as avg_price,
  AVG(distance_km) as avg_distance
FROM jobs
GROUP BY status;

-- ============================================
-- BIDDING ANALYTICS
-- ============================================

-- View all active bids
SELECT
  b.id,
  b.amount_ttd,
  b.eta_minutes,
  b.status,
  j.pickup_location_text,
  j.customer_offer_ttd,
  p.full_name as courier_name,
  b.created_at
FROM bids b
JOIN jobs j ON b.job_id = j.id
JOIN couriers c ON b.courier_id = c.id
JOIN profiles p ON c.user_id = p.id
WHERE b.status = 'active'
ORDER BY b.created_at DESC;

-- Bid acceptance rate
SELECT
  COUNT(*) FILTER (WHERE status = 'accepted') as accepted,
  COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
  COUNT(*) FILTER (WHERE status = 'active') as active,
  COUNT(*) as total,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'accepted')::numeric /
    NULLIF(COUNT(*), 0) * 100,
    2
  ) as acceptance_rate_percent
FROM bids;

-- Average bid vs customer offer
SELECT
  AVG(b.amount_ttd) as avg_bid,
  AVG(j.customer_offer_ttd) as avg_customer_offer,
  AVG(b.amount_ttd - j.customer_offer_ttd) as avg_difference
FROM bids b
JOIN jobs j ON b.job_id = j.id;

-- ============================================
-- PLATFORM STATISTICS
-- ============================================

-- Platform overview
SELECT
  (SELECT COUNT(*) FROM profiles WHERE role = 'customer') as total_customers,
  (SELECT COUNT(*) FROM profiles WHERE role = 'courier') as total_couriers,
  (SELECT COUNT(*) FROM couriers WHERE verification_status = 'approved') as approved_couriers,
  (SELECT COUNT(*) FROM jobs) as total_jobs,
  (SELECT COUNT(*) FROM jobs WHERE status = 'completed') as completed_jobs,
  (SELECT COUNT(*) FROM bids) as total_bids;

-- Revenue potential (total of all completed jobs)
SELECT
  COUNT(*) as completed_jobs,
  SUM(customer_offer_ttd) as total_value,
  AVG(customer_offer_ttd) as avg_job_value,
  MIN(customer_offer_ttd) as min_job_value,
  MAX(customer_offer_ttd) as max_job_value
FROM jobs
WHERE status = 'completed';

-- Most active customers (by job count)
SELECT
  p.full_name,
  p.email,
  COUNT(j.id) as job_count,
  SUM(j.customer_offer_ttd) as total_spent,
  AVG(j.customer_offer_ttd) as avg_per_job
FROM profiles p
JOIN jobs j ON p.id = j.customer_user_id
GROUP BY p.id, p.full_name, p.email
ORDER BY job_count DESC
LIMIT 10;

-- Most active couriers (by bid count)
SELECT
  p.full_name,
  p.email,
  COUNT(b.id) as bid_count,
  COUNT(*) FILTER (WHERE b.status = 'accepted') as accepted_bids,
  AVG(b.amount_ttd) as avg_bid_amount
FROM profiles p
JOIN couriers c ON p.id = c.user_id
JOIN bids b ON c.id = b.courier_id
GROUP BY p.id, p.full_name, p.email
ORDER BY bid_count DESC
LIMIT 10;

-- ============================================
-- DATA CLEANUP (USE WITH CAUTION!)
-- ============================================

-- Delete a test user and all related data (CASCADE handles related records)
-- CAUTION: This permanently deletes all user data!
-- DELETE FROM profiles WHERE email = 'test@example.com';

-- Reset courier verification status (for testing)
-- UPDATE couriers
-- SET verification_status = 'pending',
--     verified = false
-- WHERE user_id = 'user-uuid-here';

-- Cancel all open/bidding jobs (for maintenance)
-- UPDATE jobs
-- SET status = 'cancelled'
-- WHERE status IN ('open', 'bidding');

-- ============================================
-- DEBUGGING QUERIES
-- ============================================

-- Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- View storage bucket configuration
SELECT * FROM storage.buckets;

-- Check authentication users
SELECT
  id,
  email,
  email_confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 20;

-- Find orphaned records (couriers without profiles - should be none)
SELECT c.*
FROM couriers c
LEFT JOIN profiles p ON c.user_id = p.id
WHERE p.id IS NULL;

-- ============================================
-- PERFORMANCE MONITORING
-- ============================================

-- Slow query analysis (if pg_stat_statements is enabled)
-- SELECT
--   query,
--   calls,
--   mean_exec_time,
--   max_exec_time
-- FROM pg_stat_statements
-- ORDER BY mean_exec_time DESC
-- LIMIT 10;

-- Table sizes
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================
-- BACKUP VERIFICATION
-- ============================================

-- Export user count by month (for growth tracking)
SELECT
  DATE_TRUNC('month', created_at) as month,
  role,
  COUNT(*) as new_users
FROM profiles
GROUP BY month, role
ORDER BY month DESC;

-- Last activity timestamp by table
SELECT
  'profiles' as table_name,
  MAX(created_at) as last_activity
FROM profiles
UNION ALL
SELECT
  'jobs' as table_name,
  MAX(created_at) as last_activity
FROM jobs
UNION ALL
SELECT
  'bids' as table_name,
  MAX(created_at) as last_activity
FROM bids;
