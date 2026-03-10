/*
  # Adjust Booking Likelihood for Recommended Price Range

  1. Changes
    - Added p_recommended_high_ttd parameter
    - When price is in recommended range (LOW to HIGH) = 85-99% likelihood
    - When price is at or above HIGH = 100% likelihood
    - Below LOW = below 40% as before
    - $0 = 0% as before
  
  2. Scoring Logic
    - Price at or above HIGH = guaranteed 100%
    - Price in recommended range = scales from 85% to 99%
    - Price below LOW but above 50% of LOW = max 39%
    - Price below 50% of LOW = max 20%
    - Price at $0 = 0%
*/

CREATE OR REPLACE FUNCTION calculate_booking_likelihood(
  p_distance_km numeric,
  p_cargo_size text,
  p_urgency_hours numeric,
  p_customer_offer_ttd numeric,
  p_recommended_mid_ttd numeric,
  p_recommended_low_ttd numeric DEFAULT NULL,
  p_recommended_high_ttd numeric DEFAULT NULL
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
  range_position numeric;
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

  -- Calculate base score (before price consideration)
  base_score := distance_score + cargo_score + urgency_score;

  -- Determine recommended low and high (use parameters if provided, otherwise calculate)
  IF p_recommended_low_ttd IS NOT NULL AND p_recommended_low_ttd > 0 THEN
    recommended_low := p_recommended_low_ttd;
  ELSE
    recommended_low := p_recommended_mid_ttd * 0.85;
  END IF;

  IF p_recommended_high_ttd IS NOT NULL AND p_recommended_high_ttd > 0 THEN
    recommended_high := p_recommended_high_ttd;
  ELSE
    recommended_high := p_recommended_mid_ttd * 1.2;
  END IF;

  -- CRITICAL: Price scoring with heavy influence
  -- Price is 0 or negative = INSTANT 0% likelihood
  IF p_customer_offer_ttd <= 0 THEN
    total_score := 0;
    likelihood_label := 'No likelihood - price required';
    
    RETURN jsonb_build_object(
      'score', 0,
      'label', likelihood_label,
      'breakdown', jsonb_build_object(
        'distance', distance_score,
        'cargo', cargo_score,
        'urgency', urgency_score,
        'price', 0
      )
    );
  END IF;

  -- NEW LOGIC: Check if price is at or above recommended HIGH
  IF p_customer_offer_ttd >= recommended_high THEN
    -- Guaranteed 100% when at or above HIGH
    total_score := 100;
    likelihood_label := 'Excellent chance of pickup';
    
    RETURN jsonb_build_object(
      'score', 100,
      'label', likelihood_label,
      'breakdown', jsonb_build_object(
        'distance', distance_score,
        'cargo', cargo_score,
        'urgency', urgency_score,
        'price', 35
      )
    );
  END IF;

  -- NEW LOGIC: Check if price is in recommended range (LOW to HIGH)
  IF p_customer_offer_ttd >= recommended_low THEN
    -- Scale from 85% to 99% based on position in range
    range_position := (p_customer_offer_ttd - recommended_low) / (recommended_high - recommended_low);
    -- Ensure range_position is between 0 and 1
    range_position := LEAST(GREATEST(range_position, 0), 1);
    -- Scale: 85 + (range_position * 14) gives us 85 to 99
    total_score := 85 + (range_position * 14);
    
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

  -- Calculate price ratio for below LOW scenarios
  price_ratio := p_customer_offer_ttd / p_recommended_mid_ttd;
  
  -- Price scoring for below LOW prices
  IF price_ratio >= 0.7 THEN
    price_score := 15;
  ELSIF price_ratio >= 0.5 THEN
    price_score := 10;
  ELSIF price_ratio >= 0.3 THEN
    price_score := 5;
  ELSE
    price_score := 2;
  END IF;

  -- Apply price-based caps using actual recommended LOW price
  IF p_customer_offer_ttd < (recommended_low * 0.5) THEN
    -- Extremely low price (less than 50% of LOW): cap at 20%
    total_score := LEAST(base_score + price_score, 20);
  ELSE
    -- Below recommended LOW but above 50% of LOW: cap at 39% (below 40%)
    total_score := LEAST(base_score + price_score, 39);
  END IF;

  -- Determine label based on total score
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