/*
  # MoveMe TT Logistics Marketplace Schema

  1. New Tables
    - `profiles`
      - `id` (uuid, primary key, references auth.users)
      - `role` (text: customer|courier|business|admin)
      - `first_name` (text)
      - `last_name` (text)
      - `full_name` (text)
      - `email` (text)
      - `phone` (text)
      - `avatar_url` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `couriers`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `verified` (boolean)
      - `verification_status` (text: pending|approved|rejected)
      - `vehicle_type` (text)
      - `vehicle_make` (text)
      - `vehicle_model` (text)
      - `vehicle_year` (integer)
      - `vehicle_plate` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `courier_documents`
      - `id` (uuid, primary key)
      - `courier_id` (uuid, references couriers)
      - `doc_type` (text: drivers_license|vehicle_registration|insurance|other)
      - `file_path` (text)
      - `status` (text: pending|approved|rejected)
      - `rejection_reason` (text, nullable)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `jobs`
      - `id` (uuid, primary key)
      - `customer_user_id` (uuid, references profiles)
      - `assigned_courier_id` (uuid, nullable, references couriers)
      - `status` (text: draft|open|bidding|assigned|in_progress|completed|cancelled)
      - `pickup_location_text` (text)
      - `dropoff_location_text` (text)
      - `pickup_lat` (numeric)
      - `pickup_lng` (numeric)
      - `dropoff_lat` (numeric)
      - `dropoff_lng` (numeric)
      - `distance_km` (numeric)
      - `cargo_weight_kg` (numeric)
      - `cargo_size_category` (text: small|medium|large)
      - `cargo_notes` (text)
      - `urgency_hours` (numeric)
      - `customer_offer_ttd` (numeric)
      - `recommended_low_ttd` (numeric)
      - `recommended_mid_ttd` (numeric)
      - `recommended_high_ttd` (numeric)
      - `likelihood_label` (text)
      - `likelihood_score` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `bids`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references jobs)
      - `courier_id` (uuid, references couriers)
      - `amount_ttd` (numeric)
      - `eta_minutes` (integer)
      - `message` (text)
      - `status` (text: active|withdrawn|accepted|rejected)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `messages`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references jobs)
      - `sender_id` (uuid, references profiles)
      - `content` (text)
      - `created_at` (timestamptz)
    
    - `ai_support_conversations`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `role` (text: user|assistant)
      - `content` (text)
      - `context_type` (text, nullable)
      - `job_id` (uuid, nullable, references jobs)
      - `created_at` (timestamptz)
    
    - `delivery_proofs`
      - `id` (uuid, primary key)
      - `job_id` (uuid, references jobs)
      - `courier_id` (uuid, references couriers)
      - `photo_path` (text, nullable)
      - `signature_path` (text, nullable)
      - `notes` (text, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Add policies for role-based access control
    - Profiles: users can manage their own profile
    - Jobs: customers see their jobs, approved couriers see open jobs
    - Bids: couriers can bid, customers see bids on their jobs
    - Messages: only job participants can access
    - Documents: courier owns, admin can view

  3. Functions
    - `calculate_booking_likelihood`: Calculate likelihood score and label
    - `calculate_price_recommendation`: Calculate recommended pricing tiers
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('customer', 'courier', 'business', 'admin')),
  first_name text,
  last_name text,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create couriers table
CREATE TABLE IF NOT EXISTS couriers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verified boolean DEFAULT false,
  verification_status text DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  vehicle_type text,
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_plate text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create courier_documents table
CREATE TABLE IF NOT EXISTS courier_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  courier_id uuid NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('drivers_license', 'vehicle_registration', 'insurance', 'other')),
  file_path text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_courier_id uuid REFERENCES couriers(id) ON DELETE SET NULL,
  status text DEFAULT 'open' CHECK (status IN ('draft', 'open', 'bidding', 'assigned', 'in_progress', 'completed', 'cancelled')),
  pickup_location_text text NOT NULL,
  dropoff_location_text text NOT NULL,
  pickup_lat numeric NOT NULL,
  pickup_lng numeric NOT NULL,
  dropoff_lat numeric NOT NULL,
  dropoff_lng numeric NOT NULL,
  distance_km numeric NOT NULL,
  cargo_weight_kg numeric,
  cargo_size_category text CHECK (cargo_size_category IN ('small', 'medium', 'large')),
  cargo_notes text,
  urgency_hours numeric,
  customer_offer_ttd numeric,
  recommended_low_ttd numeric,
  recommended_mid_ttd numeric,
  recommended_high_ttd numeric,
  likelihood_label text,
  likelihood_score numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create bids table
CREATE TABLE IF NOT EXISTS bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  amount_ttd numeric NOT NULL,
  eta_minutes integer,
  message text,
  status text DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(job_id, courier_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create ai_support_conversations table
CREATE TABLE IF NOT EXISTS ai_support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  context_type text,
  job_id uuid REFERENCES jobs(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create delivery_proofs table
CREATE TABLE IF NOT EXISTS delivery_proofs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  courier_id uuid NOT NULL REFERENCES couriers(id) ON DELETE CASCADE,
  photo_path text,
  signature_path text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_couriers_user_id ON couriers(user_id);
CREATE INDEX IF NOT EXISTS idx_couriers_verification_status ON couriers(verification_status);
CREATE INDEX IF NOT EXISTS idx_jobs_customer_user_id ON jobs(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_courier_id ON jobs(assigned_courier_id);
CREATE INDEX IF NOT EXISTS idx_bids_job_id ON bids(job_id);
CREATE INDEX IF NOT EXISTS idx_bids_courier_id ON bids(courier_id);
CREATE INDEX IF NOT EXISTS idx_messages_job_id ON messages(job_id);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE couriers ENABLE ROW LEVEL SECURITY;
ALTER TABLE courier_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_proofs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Couriers policies
CREATE POLICY "Couriers can view own courier profile"
  ON couriers FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can view approved couriers"
  ON couriers FOR SELECT
  TO authenticated
  USING (verification_status = 'approved');

CREATE POLICY "Users can insert own courier profile"
  ON couriers FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Couriers can update own profile"
  ON couriers FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Courier documents policies
CREATE POLICY "Couriers can view own documents"
  ON courier_documents FOR SELECT
  TO authenticated
  USING (
    courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Couriers can insert own documents"
  ON courier_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
  );

-- Jobs policies
CREATE POLICY "Customers can view own jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (customer_user_id = auth.uid());

CREATE POLICY "Approved couriers can view open jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    status IN ('open', 'bidding') AND
    EXISTS (
      SELECT 1 FROM couriers
      WHERE couriers.user_id = auth.uid()
      AND couriers.verification_status = 'approved'
    )
  );

CREATE POLICY "Assigned couriers can view their jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    assigned_courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can insert own jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (customer_user_id = auth.uid());

CREATE POLICY "Customers can update own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (customer_user_id = auth.uid())
  WITH CHECK (customer_user_id = auth.uid());

-- Bids policies
CREATE POLICY "Approved couriers can insert bids"
  ON bids FOR INSERT
  TO authenticated
  WITH CHECK (
    courier_id IN (
      SELECT id FROM couriers
      WHERE user_id = auth.uid()
      AND verification_status = 'approved'
    )
  );

CREATE POLICY "Couriers can view own bids"
  ON bids FOR SELECT
  TO authenticated
  USING (
    courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Customers can view bids on their jobs"
  ON bids FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM jobs WHERE customer_user_id = auth.uid()
    )
  );

CREATE POLICY "Couriers can update own bids"
  ON bids FOR UPDATE
  TO authenticated
  USING (
    courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    )
  );

-- Messages policies
CREATE POLICY "Job participants can view messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE customer_user_id = auth.uid()
      OR assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Job participants can insert messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    job_id IN (
      SELECT id FROM jobs
      WHERE customer_user_id = auth.uid()
      OR assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- AI support conversations policies
CREATE POLICY "Users can view own support conversations"
  ON ai_support_conversations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own support conversations"
  ON ai_support_conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Delivery proofs policies
CREATE POLICY "Job participants can view delivery proofs"
  ON delivery_proofs FOR SELECT
  TO authenticated
  USING (
    job_id IN (
      SELECT id FROM jobs
      WHERE customer_user_id = auth.uid()
      OR assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Assigned couriers can insert delivery proofs"
  ON delivery_proofs FOR INSERT
  TO authenticated
  WITH CHECK (
    courier_id IN (
      SELECT id FROM couriers WHERE user_id = auth.uid()
    ) AND
    job_id IN (
      SELECT id FROM jobs
      WHERE assigned_courier_id IN (
        SELECT id FROM couriers WHERE user_id = auth.uid()
      )
    )
  );

-- Function to calculate price recommendation
CREATE OR REPLACE FUNCTION calculate_price_recommendation(
  p_distance_km numeric,
  p_cargo_size text,
  p_urgency_hours numeric
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  base_rate_per_km numeric := 15.0;
  cargo_multiplier numeric := 1.0;
  urgency_multiplier numeric := 1.0;
  base_price numeric;
  low_price numeric;
  mid_price numeric;
  high_price numeric;
BEGIN
  -- Cargo size multiplier
  CASE p_cargo_size
    WHEN 'small' THEN cargo_multiplier := 1.0;
    WHEN 'medium' THEN cargo_multiplier := 1.3;
    WHEN 'large' THEN cargo_multiplier := 1.6;
    ELSE cargo_multiplier := 1.0;
  END CASE;

  -- Urgency multiplier (lower hours = higher urgency = higher price)
  IF p_urgency_hours <= 2 THEN
    urgency_multiplier := 1.5;
  ELSIF p_urgency_hours <= 6 THEN
    urgency_multiplier := 1.3;
  ELSIF p_urgency_hours <= 24 THEN
    urgency_multiplier := 1.1;
  ELSE
    urgency_multiplier := 1.0;
  END IF;

  -- Calculate base price
  base_price := (p_distance_km * base_rate_per_km) * cargo_multiplier * urgency_multiplier;

  -- Add minimum fee
  IF base_price < 50 THEN
    base_price := 50;
  END IF;

  -- Calculate price tiers
  low_price := ROUND(base_price * 0.85);
  mid_price := ROUND(base_price);
  high_price := ROUND(base_price * 1.2);

  RETURN jsonb_build_object(
    'low', low_price,
    'mid', mid_price,
    'high', high_price
  );
END;
$$;

-- Function to calculate booking likelihood
CREATE OR REPLACE FUNCTION calculate_booking_likelihood(
  p_distance_km numeric,
  p_cargo_size text,
  p_urgency_hours numeric,
  p_customer_offer_ttd numeric,
  p_recommended_mid_ttd numeric
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  distance_score numeric := 0;
  cargo_score numeric := 0;
  urgency_score numeric := 0;
  price_score numeric := 0;
  total_score numeric := 0;
  likelihood_label text;
  price_ratio numeric;
BEGIN
  -- Distance scoring (shorter distances score higher, max 25 points)
  IF p_distance_km <= 5 THEN
    distance_score := 25;
  ELSIF p_distance_km <= 15 THEN
    distance_score := 20;
  ELSIF p_distance_km <= 30 THEN
    distance_score := 15;
  ELSIF p_distance_km <= 50 THEN
    distance_score := 10;
  ELSE
    distance_score := 5;
  END IF;

  -- Cargo scoring (smaller cargo scores higher, max 20 points)
  CASE p_cargo_size
    WHEN 'small' THEN cargo_score := 20;
    WHEN 'medium' THEN cargo_score := 15;
    WHEN 'large' THEN cargo_score := 10;
    ELSE cargo_score := 10;
  END CASE;

  -- Urgency scoring (more flexible time = higher score, max 20 points)
  IF p_urgency_hours >= 48 THEN
    urgency_score := 20;
  ELSIF p_urgency_hours >= 24 THEN
    urgency_score := 15;
  ELSIF p_urgency_hours >= 6 THEN
    urgency_score := 10;
  ELSE
    urgency_score := 5;
  END IF;

  -- Price scoring (offer vs recommended, max 35 points)
  price_ratio := p_customer_offer_ttd / NULLIF(p_recommended_mid_ttd, 0);
  IF price_ratio >= 1.2 THEN
    price_score := 35;
  ELSIF price_ratio >= 1.0 THEN
    price_score := 30;
  ELSIF price_ratio >= 0.9 THEN
    price_score := 20;
  ELSIF price_ratio >= 0.8 THEN
    price_score := 10;
  ELSE
    price_score := 5;
  END IF;

  -- Calculate total score
  total_score := distance_score + cargo_score + urgency_score + price_score;

  -- Determine label
  IF total_score >= 70 THEN
    likelihood_label := 'High chance of pickup';
  ELSIF total_score >= 50 THEN
    likelihood_label := 'Good chance of pickup';
  ELSE
    likelihood_label := 'Low chance of quick pickup';
  END IF;

  RETURN jsonb_build_object(
    'score', total_score,
    'label', likelihood_label,
    'breakdown', jsonb_build_object(
      'distance', distance_score,
      'cargo', cargo_score,
      'urgency', urgency_score,
      'price', price_score
    )
  );
END;
$$;