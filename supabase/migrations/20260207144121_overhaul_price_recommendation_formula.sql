/*
  # Overhaul Price Recommendation Formula

  ## Summary
  Completely redesigns the price recommendation calculation to produce more
  realistic and competitive prices for Trinidad & Tobago courier deliveries.

  ## Changes
  1. **Tiered distance-based pricing** instead of flat $15/km:
     - First 5km: $8/km
     - 5-15km: $6/km
     - 15-30km: $5/km
     - 30-50km: $4/km
     - 50-100km: $3.50/km
     - 100km+: $3/km
  2. **Cargo count multiplier**: each additional cargo item adds 12% (capped at +50%)
  3. **Cargo weight surcharge**: heavier items (>25kg) add 5-30% surcharge
  4. **Multi-stop surcharge**: each additional stop adds 10-15% (diminishing)
  5. **Refined cargo size multipliers**: small=1.0, medium=1.3, large=1.7
  6. **Finer urgency tiers**: ASAP/1hr=1.6x down to next-day=1.0x
  7. **Minimum price**: $40 TTD

  ## New Parameters (backwards-compatible with defaults)
  - `p_cargo_count` (integer, DEFAULT 1)
  - `p_total_weight_kg` (numeric, DEFAULT 0)
  - `p_num_stops` (integer, DEFAULT 1)

  ## Important Notes
  - All new parameters have defaults so existing callers are unaffected
  - Price tiers remain: low=85%, mid=100%, high=120% of calculated base
*/

CREATE OR REPLACE FUNCTION calculate_price_recommendation(
  p_distance_km numeric,
  p_cargo_size text,
  p_urgency_hours numeric,
  p_cargo_count integer DEFAULT 1,
  p_total_weight_kg numeric DEFAULT 0,
  p_num_stops integer DEFAULT 1
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
  base_price numeric;
  low_price numeric;
  mid_price numeric;
  high_price numeric;
  effective_count integer;
BEGIN
  remaining_km := GREATEST(p_distance_km, 0);

  -- Tier 1: first 5km at $8/km
  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 5) * 8;
    remaining_km := remaining_km - 5;
  END IF;

  -- Tier 2: 5-15km at $6/km
  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 10) * 6;
    remaining_km := remaining_km - 10;
  END IF;

  -- Tier 3: 15-30km at $5/km
  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 15) * 5;
    remaining_km := remaining_km - 15;
  END IF;

  -- Tier 4: 30-50km at $4/km
  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 20) * 4;
    remaining_km := remaining_km - 20;
  END IF;

  -- Tier 5: 50-100km at $3.50/km
  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + LEAST(remaining_km, 50) * 3.5;
    remaining_km := remaining_km - 50;
  END IF;

  -- Tier 6: 100km+ at $3/km
  IF remaining_km > 0 THEN
    tiered_distance_cost := tiered_distance_cost + remaining_km * 3;
  END IF;

  -- Cargo size multiplier
  CASE p_cargo_size
    WHEN 'small' THEN cargo_size_multiplier := 1.0;
    WHEN 'medium' THEN cargo_size_multiplier := 1.3;
    WHEN 'large' THEN cargo_size_multiplier := 1.7;
    ELSE cargo_size_multiplier := 1.0;
  END CASE;

  -- Cargo count multiplier: each additional item adds 12%, capped at +50%
  effective_count := GREATEST(COALESCE(p_cargo_count, 1), 1);
  IF effective_count > 1 THEN
    cargo_count_multiplier := 1.0 + LEAST((effective_count - 1) * 0.12, 0.50);
  END IF;

  -- Weight surcharge (based on total weight across all items)
  IF COALESCE(p_total_weight_kg, 0) > 200 THEN
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

  -- Urgency multiplier (finer tiers)
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

  -- Multi-stop surcharge: each additional stop adds diminishing surcharge
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

  -- Calculate base price with all multipliers
  base_price := tiered_distance_cost
    * cargo_size_multiplier
    * cargo_count_multiplier
    * weight_surcharge
    * urgency_multiplier
    * stop_surcharge;

  -- Minimum fee
  IF base_price < 40 THEN
    base_price := 40;
  END IF;

  -- Price tiers
  low_price := ROUND(base_price * 0.85);
  mid_price := ROUND(base_price);
  high_price := ROUND(base_price * 1.20);

  RETURN jsonb_build_object(
    'low', low_price,
    'mid', mid_price,
    'high', high_price
  );
END;
$$;
