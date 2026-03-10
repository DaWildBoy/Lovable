/*
  # Recalibrate Booking Likelihood Scoring

  ## Summary
  Adjusts the scoring curve so that:
  - At recommended LOW price: ~50% likelihood (fair chance)
  - At recommended MID price: ~70% likelihood (good chance)
  - At recommended HIGH price: ~90%+ likelihood (excellent chance)
  - Below LOW: drops steeply towards 0%
  - Above HIGH: 95-100%

  ## Changes
  - Rewrote the scoring ranges for within-recommended-range offers
  - Below-range scoring now drops more aggressively
  - Near-threshold zone narrowed
  - Much lower caps for significantly below-range offers

  ## Important Notes
  - This replaces the previous likelihood function entirely
  - Historical data blending is preserved
  - Cargo count and stop penalties are preserved
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
  p_num_stops integer DEFAULT 1
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
  recommended_low numeric;
  recommended_high numeric;
  effective_mid numeric;
  range_position numeric;
  cargo_count_penalty numeric := 0;
  stop_penalty numeric := 0;
  hist_avg_price numeric;
  hist_count integer;
BEGIN
  -- Distance scoring (shorter distances score higher, max 10 points)
  IF p_distance_km <= 5 THEN
    distance_score := 10;
  ELSIF p_distance_km <= 15 THEN
    distance_score := 8;
  ELSIF p_distance_km <= 30 THEN
    distance_score := 6;
  ELSIF p_distance_km <= 50 THEN
    distance_score := 4;
  ELSIF p_distance_km <= 80 THEN
    distance_score := 3;
  ELSE
    distance_score := 2;
  END IF;

  -- Cargo scoring (smaller cargo scores higher, max 8 points)
  CASE p_cargo_size
    WHEN 'small' THEN cargo_score := 8;
    WHEN 'medium' THEN cargo_score := 5;
    WHEN 'large' THEN cargo_score := 3;
    ELSE cargo_score := 4;
  END CASE;

  -- Cargo count penalty (more items = slightly less attractive, max -3 pts)
  IF COALESCE(p_cargo_count, 1) > 1 THEN
    cargo_count_penalty := LEAST((p_cargo_count - 1) * 1.0, 3);
    cargo_score := GREATEST(cargo_score - cargo_count_penalty, 1);
  END IF;

  -- Multi-stop penalty (max -3 pts)
  IF COALESCE(p_num_stops, 1) > 1 THEN
    stop_penalty := LEAST((p_num_stops - 1) * 1.0, 3);
    distance_score := GREATEST(distance_score - stop_penalty, 1);
  END IF;

  -- Urgency scoring (max 7 points)
  IF p_urgency_hours >= 48 THEN
    urgency_score := 7;
  ELSIF p_urgency_hours >= 24 THEN
    urgency_score := 5;
  ELSIF p_urgency_hours >= 8 THEN
    urgency_score := 4;
  ELSIF p_urgency_hours >= 4 THEN
    urgency_score := 3;
  ELSE
    urgency_score := 2;
  END IF;

  -- Historical price lookup
  SELECT AVG(j.customer_offer_ttd), COUNT(*)::integer
  INTO hist_avg_price, hist_count
  FROM jobs j
  WHERE j.status IN ('completed', 'delivered', 'picked_up', 'in_transit')
    AND j.distance_km BETWEEN (p_distance_km * 0.7) AND (p_distance_km * 1.3)
    AND j.cargo_size_category = p_cargo_size
    AND j.created_at >= NOW() - INTERVAL '90 days'
    AND j.customer_offer_ttd > 0;

  effective_mid := p_recommended_mid_ttd;
  IF hist_count >= 3 AND hist_avg_price IS NOT NULL AND hist_avg_price > 0 THEN
    effective_mid := (p_recommended_mid_ttd * 0.6) + (hist_avg_price * 0.4);
  END IF;

  -- Determine recommended boundaries
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

  -- Zero or negative price
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

  -- =====================================================
  -- PRICE-DOMINANT SCORING
  -- The price determines the primary band, then context
  -- factors (distance, cargo, urgency) adjust within band
  -- =====================================================

  -- Context bonus from non-price factors (max ~25 pts)
  -- Used to adjust within the price-determined band
  price_ratio := p_customer_offer_ttd / NULLIF(effective_mid, 0);

  -- BAND 1: At or above HIGH => 90-100%
  IF p_customer_offer_ttd >= recommended_high THEN
    total_score := 90 + LEAST(distance_score + cargo_score + urgency_score, 10);
    likelihood_label := 'Excellent chance of pickup';

  -- BAND 2: Between MID and HIGH => 68-89%
  ELSIF p_customer_offer_ttd >= effective_mid THEN
    range_position := (p_customer_offer_ttd - effective_mid) / NULLIF(recommended_high - effective_mid, 0);
    range_position := LEAST(GREATEST(COALESCE(range_position, 0), 0), 1);
    total_score := 68 + ROUND(range_position * 18) + LEAST(ROUND((distance_score + cargo_score + urgency_score) * 0.12), 3);

    IF total_score >= 80 THEN
      likelihood_label := 'High chance of pickup';
    ELSE
      likelihood_label := 'Good chance of pickup';
    END IF;

  -- BAND 3: Between LOW and MID => 45-67%
  ELSIF p_customer_offer_ttd >= recommended_low THEN
    range_position := (p_customer_offer_ttd - recommended_low) / NULLIF(effective_mid - recommended_low, 0);
    range_position := LEAST(GREATEST(COALESCE(range_position, 0), 0), 1);
    total_score := 45 + ROUND(range_position * 20) + LEAST(ROUND((distance_score + cargo_score + urgency_score) * 0.08), 2);

    IF total_score >= 60 THEN
      likelihood_label := 'Fair chance of pickup';
    ELSE
      likelihood_label := 'Moderate chance of pickup';
    END IF;

  -- BAND 4: 70-99% of LOW => 20-44%
  ELSIF p_customer_offer_ttd >= (recommended_low * 0.7) THEN
    range_position := (p_customer_offer_ttd - recommended_low * 0.7) / NULLIF(recommended_low * 0.3, 0);
    range_position := LEAST(GREATEST(COALESCE(range_position, 0), 0), 1);
    total_score := 20 + ROUND(range_position * 24);
    likelihood_label := 'Low chance of pickup';

  -- BAND 5: 40-69% of LOW => 8-19%
  ELSIF p_customer_offer_ttd >= (recommended_low * 0.4) THEN
    range_position := (p_customer_offer_ttd - recommended_low * 0.4) / NULLIF(recommended_low * 0.3, 0);
    range_position := LEAST(GREATEST(COALESCE(range_position, 0), 0), 1);
    total_score := 8 + ROUND(range_position * 11);
    likelihood_label := 'Very low chance of pickup';

  -- BAND 6: Below 40% of LOW => 0-7%
  ELSE
    range_position := p_customer_offer_ttd / NULLIF(recommended_low * 0.4, 0);
    range_position := LEAST(GREATEST(COALESCE(range_position, 0), 0), 1);
    total_score := ROUND(range_position * 7);
    likelihood_label := 'Very low chance of pickup';
  END IF;

  total_score := LEAST(GREATEST(ROUND(total_score), 0), 100);

  RETURN jsonb_build_object(
    'score', total_score,
    'label', likelihood_label,
    'breakdown', jsonb_build_object(
      'distance', distance_score,
      'cargo', cargo_score,
      'urgency', urgency_score,
      'price', ROUND(COALESCE(price_ratio, 0) * 10)
    )
  );
END;
$$;
