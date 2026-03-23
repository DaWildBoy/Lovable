/*
  # Comprehensive Price Recommendation Formula

  1. Changes
    - Overhauls `calculate_price_recommendation` to accept all job factors
    - Adds job_type multiplier (courier lighter, junk heavier)
    - Adds fragile cargo surcharge
    - Adds heavy lift surcharge
    - Adds needs cover surcharge
    - Adds cargo volume (dimensions) surcharge for oversized items
    - Adds high-value cargo handling premium
    - Adds security gate time surcharge
    - Adjusts base pricing tiers to ensure fair prices for both customers and drivers

  2. New Parameters
    - p_job_type: standard, courier, marketplace_safebuy, junk_removal
    - p_is_fragile: boolean
    - p_requires_heavy_lift: boolean
    - p_needs_cover: boolean
    - p_has_security_gate: boolean
    - p_total_volume_cm3: total cubic centimeters of all cargo
    - p_declared_cargo_value: declared value in TTD
    - p_cargo_insurance_enabled: whether insurance was opted in

  3. Important Notes
    - Minimum price floors vary by job type
    - All existing parameters are preserved with defaults for backward compatibility
    - The formula ensures drivers are fairly compensated for complexity while keeping prices reasonable for customers
*/

CREATE OR REPLACE FUNCTION calculate_price_recommendation(
  p_distance_km numeric,
  p_cargo_size text,
  p_urgency_hours numeric,
  p_cargo_count integer DEFAULT 1,
  p_total_weight_kg numeric DEFAULT 0,
  p_num_stops integer DEFAULT 1,
  p_job_type text DEFAULT 'standard',
  p_is_fragile boolean DEFAULT false,
  p_requires_heavy_lift boolean DEFAULT false,
  p_needs_cover boolean DEFAULT false,
  p_has_security_gate boolean DEFAULT false,
  p_total_volume_cm3 numeric DEFAULT 0,
  p_declared_cargo_value numeric DEFAULT 0,
  p_cargo_insurance_enabled boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  tiered_distance_cost numeric := 0;
  remaining_km numeric;
  cargo_size_multiplier numeric := 1.0;
  cargo_count_multiplier numeric := 1.0;
  weight_surcharge numeric := 1.0;
  urgency_multiplier numeric := 1.0;
  stop_surcharge numeric := 1.0;
  job_type_multiplier numeric := 1.0;
  special_handling_surcharge numeric := 0;
  volume_surcharge numeric := 1.0;
  high_value_premium numeric := 0;
  gate_surcharge numeric := 0;
  base_price numeric;
  low_price numeric;
  mid_price numeric;
  high_price numeric;
  effective_count integer;
  min_price numeric := 50;
  v_job_type text;
BEGIN
  v_job_type := COALESCE(p_job_type, 'standard');
  remaining_km := GREATEST(p_distance_km, 0);

  -- Tiered distance pricing (TTD per km)
  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 5) * 18;
    remaining_km := remaining_km - 5;
  END IF;

  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 10) * 14;
    remaining_km := remaining_km - 10;
  END IF;

  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 15) * 11;
    remaining_km := remaining_km - 15;
  END IF;

  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 20) * 6;
    remaining_km := remaining_km - 20;
  END IF;

  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 50) * 4;
    remaining_km := remaining_km - 50;
  END IF;

  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + remaining_km * 3;
  END IF;

  -- Job type multiplier
  CASE v_job_type
    WHEN 'courier' THEN
      job_type_multiplier := 0.75;
      min_price := 35;
    WHEN 'junk_removal' THEN
      job_type_multiplier := 1.35;
      min_price := 80;
    WHEN 'marketplace_safebuy' THEN
      job_type_multiplier := 1.10;
      min_price := 60;
    ELSE
      job_type_multiplier := 1.0;
      min_price := 50;
  END CASE;

  -- Cargo size multiplier
  CASE p_cargo_size
    WHEN 'small' THEN cargo_size_multiplier := 1.0;
    WHEN 'medium' THEN cargo_size_multiplier := 1.5;
    WHEN 'large' THEN cargo_size_multiplier := 1.85;
    ELSE cargo_size_multiplier := 1.0;
  END CASE;

  -- Cargo count multiplier (each extra item adds 12%, capped at 50%)
  effective_count := GREATEST(COALESCE(p_cargo_count, 1), 1);
  IF effective_count > 1 THEN
    cargo_count_multiplier := 1.0 + LEAST((effective_count - 1) * 0.12, 0.50);
  END IF;

  -- Weight surcharge (graduated tiers)
  IF COALESCE(p_total_weight_kg, 0) > 500 THEN
    weight_surcharge := 1.50;
  ELSIF p_total_weight_kg > 200 THEN
    weight_surcharge := 1.30;
  ELSIF p_total_weight_kg > 100 THEN
    weight_surcharge := 1.20;
  ELSIF p_total_weight_kg > 50 THEN
    weight_surcharge := 1.12;
  ELSIF p_total_weight_kg > 25 THEN
    weight_surcharge := 1.05;
  ELSE
    weight_surcharge := 1.0;
  END IF;

  -- Volume surcharge (large dimensions need bigger vehicle)
  IF COALESCE(p_total_volume_cm3, 0) > 2000000 THEN
    volume_surcharge := 1.40;
  ELSIF p_total_volume_cm3 > 1000000 THEN
    volume_surcharge := 1.25;
  ELSIF p_total_volume_cm3 > 500000 THEN
    volume_surcharge := 1.15;
  ELSIF p_total_volume_cm3 > 200000 THEN
    volume_surcharge := 1.08;
  ELSE
    volume_surcharge := 1.0;
  END IF;

  -- Urgency multiplier
  IF p_urgency_hours <= 1 THEN
    urgency_multiplier := 1.6;
  ELSIF p_urgency_hours <= 2 THEN
    urgency_multiplier := 1.4;
  ELSIF p_urgency_hours <= 4 THEN
    urgency_multiplier := 1.25;
  ELSIF p_urgency_hours <= 8 THEN
    urgency_multiplier := 1.15;
  ELSIF p_urgency_hours <= 24 THEN
    urgency_multiplier := 1.05;
  ELSE
    urgency_multiplier := 1.0;
  END IF;

  -- Multi-stop surcharge
  IF COALESCE(p_num_stops, 1) > 1 THEN
    IF p_num_stops = 2 THEN
      stop_surcharge := 1.15;
    ELSIF p_num_stops = 3 THEN
      stop_surcharge := 1.25;
    ELSIF p_num_stops = 4 THEN
      stop_surcharge := 1.33;
    ELSE
      stop_surcharge := 1.33 + (p_num_stops - 4) * 0.04;
    END IF;
  END IF;

  -- Special handling surcharges (additive flat amounts in TTD)
  IF COALESCE(p_is_fragile, false) THEN
    special_handling_surcharge := special_handling_surcharge + 25;
  END IF;

  IF COALESCE(p_requires_heavy_lift, false) THEN
    special_handling_surcharge := special_handling_surcharge + 50;
  END IF;

  IF COALESCE(p_needs_cover, false) THEN
    special_handling_surcharge := special_handling_surcharge + 20;
  END IF;

  -- Security gate surcharge (extra time navigating gates/checkpoints)
  IF COALESCE(p_has_security_gate, false) THEN
    gate_surcharge := 15;
  END IF;

  -- High-value cargo premium (drivers take on more responsibility)
  IF COALESCE(p_declared_cargo_value, 0) > 10000 THEN
    high_value_premium := 60;
  ELSIF p_declared_cargo_value > 5000 THEN
    high_value_premium := 40;
  ELSIF p_declared_cargo_value > 2000 THEN
    high_value_premium := 25;
  ELSIF p_declared_cargo_value > 500 THEN
    high_value_premium := 10;
  ELSE
    high_value_premium := 0;
  END IF;

  -- Calculate final price
  base_price := (tiered_distance_cost
    * job_type_multiplier
    * cargo_size_multiplier
    * cargo_count_multiplier
    * GREATEST(weight_surcharge, volume_surcharge)
    * urgency_multiplier
    * stop_surcharge)
    + special_handling_surcharge
    + gate_surcharge
    + high_value_premium;

  -- Enforce minimum price per job type
  IF base_price < min_price THEN
    base_price := min_price;
  END IF;

  low_price := ROUND(base_price * 0.82);
  mid_price := ROUND(base_price);
  high_price := ROUND(base_price * 1.28);

  RETURN jsonb_build_object(
    'low', low_price,
    'mid', mid_price,
    'high', high_price
  );
END;
$$;