/*
  # Increase Price Recommendation Base Rates

  ## Summary
  Increases per-km rates and cargo multipliers to better reflect real-world
  Trinidad & Tobago courier pricing. A 25.9km medium furniture move should
  recommend roughly $450-$700 TTD, not $179-$253.

  ## Changes
  1. **Higher per-km rates** (roughly doubled, with steep taper for long distance):
     - First 5km: $18/km (was $8)
     - 5-15km: $14/km (was $6)
     - 15-30km: $11/km (was $5)
     - 30-50km: $6/km (was $4)
     - 50-100km: $4/km (was $3.50)
     - 100km+: $3/km (same)
  2. **Steeper cargo multipliers**:
     - small: 1.0 (same)
     - medium: 1.5 (was 1.3)
     - large: 1.85 (was 1.7)
  3. **Wider price range**:
     - LOW: 82% of mid (was 85%)
     - HIGH: 128% of mid (was 120%)
  4. **Minimum raised** to $50 TTD

  ## Example Pricing After Change
  - 10km, small, next-day: $138 - $215
  - 25.9km, medium, next-day: $452 - $705
  - 85km, large, next-day: $1043 - $1629
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

  CASE p_cargo_size
    WHEN 'small' THEN cargo_size_multiplier := 1.0;
    WHEN 'medium' THEN cargo_size_multiplier := 1.5;
    WHEN 'large' THEN cargo_size_multiplier := 1.85;
    ELSE cargo_size_multiplier := 1.0;
  END CASE;

  effective_count := GREATEST(COALESCE(p_cargo_count, 1), 1);
  IF effective_count > 1 THEN
    cargo_count_multiplier := 1.0 + LEAST((effective_count - 1) * 0.12, 0.50);
  END IF;

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

  base_price := tiered_distance_cost
    * cargo_size_multiplier
    * cargo_count_multiplier
    * weight_surcharge
    * urgency_multiplier
    * stop_surcharge;

  IF base_price < 50 THEN
    base_price := 50;
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
