/*
  # Update Booking Likelihood with Job Type Awareness

  1. Changes
    - Adds p_job_type parameter to calculate_booking_likelihood
    - Adds p_is_fragile and p_requires_heavy_lift parameters
    - Junk removal jobs get a slight boost because drivers earn more per job
    - Courier jobs get a boost because they are quick and easy
    - Fragile/heavy-lift jobs get a small penalty because fewer drivers want them
    - All new parameters have defaults so backward compatibility is preserved

  2. Important Notes
    - The likelihood function now considers job complexity when scoring
    - Historical data lookup also filters by job_type when available
*/

CREATE OR REPLACE FUNCTION calculate_booking_likelihood(
  p_distance_km numeric,
  p_cargo_size text,
  p_urgency_hours numeric,
  p_customer_offer_ttd numeric,
  p_recommended_mid_ttd numeric,
  p_recommended_low_ttd numeric DEFAULT NULL,
  p_recommended_high_ttd numeric DEFAULT NULL,
  p_cargo_count integer DEFAULT 1,
  p_num_stops integer DEFAULT 1,
  p_job_type text DEFAULT 'standard',
  p_is_fragile boolean DEFAULT false,
  p_requires_heavy_lift boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  distance_score numeric := 0;
  cargo_score numeric := 0;
  urgency_score numeric := 0;
  price_score numeric := 0;
  base_score numeric := 0;
  total_score numeric := 0;
  likelihood_label text;
  price_ratio numeric;
  recommended_low numeric;
  recommended_high numeric;
  effective_mid numeric;
  range_position numeric;
  near_threshold numeric;
  hist_avg_price numeric;
  hist_count integer;
  cargo_count_penalty numeric := 0;
  stop_penalty numeric := 0;
  job_type_bonus numeric := 0;
  special_handling_penalty numeric := 0;
  v_job_type text;
BEGIN
  v_job_type := COALESCE(p_job_type, 'standard');

  -- Distance scoring (shorter distances score higher, max 25 points)
  IF p_distance_km <= 5 THEN
    distance_score := 25;
  ELSIF p_distance_km <= 15 THEN
    distance_score := 22;
  ELSIF p_distance_km <= 30 THEN
    distance_score := 18;
  ELSIF p_distance_km <= 50 THEN
    distance_score := 13;
  ELSIF p_distance_km <= 80 THEN
    distance_score := 8;
  ELSE
    distance_score := 5;
  END IF;

  -- Cargo scoring (smaller cargo scores higher, max 20 points)
  CASE p_cargo_size
    WHEN 'small' THEN cargo_score := 20;
    WHEN 'medium' THEN cargo_score := 14;
    WHEN 'large' THEN cargo_score := 8;
    ELSE cargo_score := 10;
  END CASE;

  -- Cargo count penalty (more items = slightly less attractive, max -5 pts)
  IF COALESCE(p_cargo_count, 1) > 1 THEN
    cargo_count_penalty := LEAST((p_cargo_count - 1) * 1.5, 5);
    cargo_score := GREATEST(cargo_score - cargo_count_penalty, 3);
  END IF;

  -- Multi-stop penalty (more stops = slightly less attractive, max -4 pts)
  IF COALESCE(p_num_stops, 1) > 1 THEN
    stop_penalty := LEAST((p_num_stops - 1) * 1.5, 4);
    distance_score := GREATEST(distance_score - stop_penalty, 3);
  END IF;

  -- Job type bonus/penalty
  CASE v_job_type
    WHEN 'courier' THEN
      job_type_bonus := 3;
    WHEN 'junk_removal' THEN
      job_type_bonus := 2;
    WHEN 'marketplace_safebuy' THEN
      job_type_bonus := 0;
    ELSE
      job_type_bonus := 0;
  END CASE;

  -- Special handling penalty (fragile/heavy = fewer willing drivers)
  IF COALESCE(p_is_fragile, false) THEN
    special_handling_penalty := special_handling_penalty + 2;
  END IF;
  IF COALESCE(p_requires_heavy_lift, false) THEN
    special_handling_penalty := special_handling_penalty + 3;
  END IF;

  -- Urgency scoring (more flexible time = higher score, max 20 points)
  IF p_urgency_hours >= 48 THEN
    urgency_score := 20;
  ELSIF p_urgency_hours >= 24 THEN
    urgency_score := 16;
  ELSIF p_urgency_hours >= 8 THEN
    urgency_score := 12;
  ELSIF p_urgency_hours >= 4 THEN
    urgency_score := 8;
  ELSE
    urgency_score := 5;
  END IF;

  -- Calculate base score (before price consideration)
  base_score := distance_score + cargo_score + urgency_score + job_type_bonus - special_handling_penalty;
  base_score := GREATEST(base_score, 5);

  -- Historical price lookup: find average accepted price for similar jobs
  SELECT AVG(j.customer_offer_ttd), COUNT(*)::integer
  INTO hist_avg_price, hist_count
  FROM jobs j
  WHERE j.status IN ('completed', 'delivered', 'picked_up', 'in_transit')
    AND j.distance_km BETWEEN (p_distance_km * 0.7) AND (p_distance_km * 1.3)
    AND j.cargo_size_category = p_cargo_size
    AND (v_job_type = 'standard' OR j.job_type = v_job_type)
    AND j.created_at >= NOW() - INTERVAL '90 days'
    AND j.customer_offer_ttd > 0;

  -- Blend historical average with recommended mid when enough data exists
  effective_mid := p_recommended_mid_ttd;
  IF hist_count >= 3 AND hist_avg_price IS NOT NULL AND hist_avg_price > 0 THEN
    effective_mid := (p_recommended_mid_ttd * 0.6) + (hist_avg_price * 0.4);
  END IF;

  -- Determine recommended low and high
  IF p_recommended_low_ttd IS NOT NULL AND p_recommended_low_ttd > 0 THEN
    recommended_low := p_recommended_low_ttd;
  ELSE
    recommended_low := effective_mid * 0.85;
  END IF;

  IF p_recommended_high_ttd IS NOT NULL AND p_recommended_high_ttd > 0 THEN
    recommended_high := p_recommended_high_ttd;
  ELSE
    recommended_high := effective_mid * 1.2;
  END IF;

  -- Near-threshold: within $10 or 2% of LOW
  near_threshold := GREATEST(10, recommended_low * 0.02);

  -- CRITICAL: Price scoring with heavy influence
  IF p_customer_offer_ttd <= 0 THEN
    RETURN jsonb_build_object(
      'score', 0,
      'label', 'No likelihood - price required',
      'breakdown', jsonb_build_object(
        'distance', distance_score,
        'cargo', cargo_score,
        'urgency', urgency_score,
        'price', 0
      )
    );
  END IF;

  -- At or above recommended HIGH
  IF p_customer_offer_ttd >= recommended_high THEN
    RETURN jsonb_build_object(
      'score', 100,
      'label', 'Excellent chance of pickup',
      'breakdown', jsonb_build_object(
        'distance', distance_score,
        'cargo', cargo_score,
        'urgency', urgency_score,
        'price', 35
      )
    );
  END IF;

  -- In recommended range (LOW to HIGH)
  IF p_customer_offer_ttd >= recommended_low THEN
    range_position := (p_customer_offer_ttd - recommended_low) / NULLIF(recommended_high - recommended_low, 0);
    range_position := LEAST(GREATEST(COALESCE(range_position, 0.5), 0), 1);
    total_score := ROUND(85 + (range_position * 14));

    IF total_score >= 95 THEN
      likelihood_label := 'Excellent chance of pickup';
    ELSIF total_score >= 90 THEN
      likelihood_label := 'High chance of pickup';
    ELSE
      likelihood_label := 'Good chance of pickup';
    END IF;

    RETURN jsonb_build_object(
      'score', total_score,
      'label', likelihood_label,
      'breakdown', jsonb_build_object(
        'distance', distance_score,
        'cargo', cargo_score,
        'urgency', urgency_score,
        'price', 30
      )
    );
  END IF;

  -- Near LOW threshold (within $10 or 2%)
  IF p_customer_offer_ttd >= (recommended_low - near_threshold) THEN
    range_position := (p_customer_offer_ttd - (recommended_low - near_threshold)) / NULLIF(near_threshold, 0);
    range_position := LEAST(GREATEST(COALESCE(range_position, 0.5), 0), 1);
    total_score := ROUND(80 + (range_position * 4));
    likelihood_label := 'Good chance of pickup';

    RETURN jsonb_build_object(
      'score', total_score,
      'label', likelihood_label,
      'breakdown', jsonb_build_object(
        'distance', distance_score,
        'cargo', cargo_score,
        'urgency', urgency_score,
        'price', 25
      )
    );
  END IF;

  -- Below LOW: use price ratio against effective mid
  price_ratio := p_customer_offer_ttd / NULLIF(effective_mid, 0);

  IF price_ratio >= 0.7 THEN
    price_score := 15;
  ELSIF price_ratio >= 0.5 THEN
    price_score := 10;
  ELSIF price_ratio >= 0.3 THEN
    price_score := 5;
  ELSE
    price_score := 2;
  END IF;

  -- Apply price-based caps
  IF p_customer_offer_ttd < (recommended_low * 0.5) THEN
    total_score := LEAST(base_score + price_score, 20);
  ELSE
    total_score := LEAST(base_score + price_score, 39);
  END IF;

  total_score := ROUND(total_score);

  IF total_score >= 30 THEN
    likelihood_label := 'Fair chance of pickup';
  ELSIF total_score >= 15 THEN
    likelihood_label := 'Low chance of pickup';
  ELSE
    likelihood_label := 'Very low chance of pickup';
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