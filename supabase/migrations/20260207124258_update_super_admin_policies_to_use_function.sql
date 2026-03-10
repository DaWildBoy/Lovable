/*
  # Update all super admin policies to use is_super_admin() function

  1. Problem
    - All super admin policies across tables use inline subqueries against profiles
    - This can cause chain-recursion issues

  2. Solution
    - Replace all inline profile subqueries with the is_super_admin() function
    - The function is SECURITY DEFINER and bypasses RLS
*/

-- Jobs
DROP POLICY IF EXISTS "Super admins can view all jobs" ON jobs;
CREATE POLICY "Super admins can view all jobs"
  ON jobs FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins can update all jobs" ON jobs;
CREATE POLICY "Super admins can update all jobs"
  ON jobs FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Conversations
DROP POLICY IF EXISTS "Super admins can view all conversations" ON conversations;
CREATE POLICY "Super admins can view all conversations"
  ON conversations FOR SELECT TO authenticated USING (is_super_admin());

-- Messages
DROP POLICY IF EXISTS "Super admins can view all messages" ON messages;
CREATE POLICY "Super admins can view all messages"
  ON messages FOR SELECT TO authenticated USING (is_super_admin());

-- Couriers
DROP POLICY IF EXISTS "Super admins can view all couriers" ON couriers;
CREATE POLICY "Super admins can view all couriers"
  ON couriers FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins can update all couriers" ON couriers;
CREATE POLICY "Super admins can update all couriers"
  ON couriers FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Notifications
DROP POLICY IF EXISTS "Super admins can view all notifications" ON notifications;
CREATE POLICY "Super admins can view all notifications"
  ON notifications FOR SELECT TO authenticated USING (is_super_admin());

-- Business subscriptions
DROP POLICY IF EXISTS "Super admins can view all business subscriptions" ON business_subscriptions;
CREATE POLICY "Super admins can view all business subscriptions"
  ON business_subscriptions FOR SELECT TO authenticated USING (is_super_admin());

DROP POLICY IF EXISTS "Super admins can update all business subscriptions" ON business_subscriptions;
CREATE POLICY "Super admins can update all business subscriptions"
  ON business_subscriptions FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Cargo items
DROP POLICY IF EXISTS "Super admins can view all cargo items" ON cargo_items;
CREATE POLICY "Super admins can view all cargo items"
  ON cargo_items FOR SELECT TO authenticated USING (is_super_admin());

-- Delivery stops
DROP POLICY IF EXISTS "Super admins can view all delivery stops" ON delivery_stops;
CREATE POLICY "Super admins can view all delivery stops"
  ON delivery_stops FOR SELECT TO authenticated USING (is_super_admin());

-- Conversation participants
DROP POLICY IF EXISTS "Super admins can view all conversation participants" ON conversation_participants;
CREATE POLICY "Super admins can view all conversation participants"
  ON conversation_participants FOR SELECT TO authenticated USING (is_super_admin());

-- Counter offers
DROP POLICY IF EXISTS "Super admins can view all counter offers" ON counter_offers;
CREATE POLICY "Super admins can view all counter offers"
  ON counter_offers FOR SELECT TO authenticated USING (is_super_admin());

-- Provider ratings
DROP POLICY IF EXISTS "Super admins can view all provider ratings" ON provider_ratings;
CREATE POLICY "Super admins can view all provider ratings"
  ON provider_ratings FOR SELECT TO authenticated USING (is_super_admin());

-- Haulage drivers
DROP POLICY IF EXISTS "Super admins can view all haulage drivers" ON haulage_drivers;
CREATE POLICY "Super admins can view all haulage drivers"
  ON haulage_drivers FOR SELECT TO authenticated USING (is_super_admin());

-- Haulage vehicles
DROP POLICY IF EXISTS "Super admins can view all haulage vehicles" ON haulage_vehicles;
CREATE POLICY "Super admins can view all haulage vehicles"
  ON haulage_vehicles FOR SELECT TO authenticated USING (is_super_admin());

-- Proof of delivery
DROP POLICY IF EXISTS "Super admins can view all proof of delivery" ON proof_of_delivery;
CREATE POLICY "Super admins can view all proof of delivery"
  ON proof_of_delivery FOR SELECT TO authenticated USING (is_super_admin());

-- Saved locations
DROP POLICY IF EXISTS "Super admins can view all saved locations" ON saved_locations;
CREATE POLICY "Super admins can view all saved locations"
  ON saved_locations FOR SELECT TO authenticated USING (is_super_admin());

-- Subscription payments (add super admin access)
DROP POLICY IF EXISTS "Super admins can view all subscription payments" ON subscription_payments;
CREATE POLICY "Super admins can view all subscription payments"
  ON subscription_payments FOR SELECT TO authenticated USING (is_super_admin());
