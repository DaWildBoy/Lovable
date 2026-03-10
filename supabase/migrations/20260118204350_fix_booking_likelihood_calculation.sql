/*
  # Fix Booking Likelihood Calculation

  1. Changes
    - Updated `calculate_booking_likelihood` function to properly handle edge cases
    - Price score now returns 0 when customer offer is 0 or negative
    - Improved price ratio calculation to handle divide-by-zero scenarios
    - Ensured total score can reach 100% when all conditions are optimal
  
  2. Notes
    - Max possible score: 25 (distance) + 20 (cargo) + 20 (urgency) + 35 (price) = 100
    - When price is $0 or negative, price score is 0, making max score 65
    - When price is very low compared to recommended, score reflects poor likelihood
*/

-- Drop and recreate the function with fixes
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
  -- If customer offer is 0 or negative, score is 0
  IF p_customer_offer_ttd <= 0 THEN
    price_score := 0;
  ELSIF p_recommended_mid_ttd <= 0 THEN
    -- If recommended mid is invalid, use a basic score based on absolute value
    IF p_customer_offer_ttd >= 100 THEN
      price_score := 30;
    ELSIF p_customer_offer_ttd >= 50 THEN
      price_score := 20;
    ELSE
      price_score := 10;
    END IF;
  ELSE
    -- Calculate price ratio
    price_ratio := p_customer_offer_ttd / p_recommended_mid_ttd;
    
    IF price_ratio >= 1.2 THEN
      price_score := 35;
    ELSIF price_ratio >= 1.0 THEN
      price_score := 30;
    ELSIF price_ratio >= 0.9 THEN
      price_score := 20;
    ELSIF price_ratio >= 0.8 THEN
      price_score := 10;
    ELSIF price_ratio >= 0.5 THEN
      price_score := 5;
    ELSE
      -- Very low offer (less than 50% of recommended) gets 0 points
      price_score := 0;
    END IF;
  END IF;

  -- Calculate total score (capped at 100)
  total_score := LEAST(distance_score + cargo_score + urgency_score + price_score, 100);

  -- Determine label
  IF total_score >= 80 THEN
    likelihood_label := 'Excellent chance of pickup';
  ELSIF total_score >= 70 THEN
    likelihood_label := 'High chance of pickup';
  ELSIF total_score >= 50 THEN
    likelihood_label := 'Good chance of pickup';
  ELSIF total_score >= 30 THEN
    likelihood_label := 'Fair chance of pickup';
  ELSE
    likelihood_label := 'Low chance of pickup';
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