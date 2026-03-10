/*
  # Add Low Price Parameter to Booking Likelihood

  1. Changes
    - Added p_recommended_low_ttd parameter to function
    - Uses actual recommended LOW price instead of ratio calculations
    - More precise thresholds:
      - $0 = 0% likelihood
      - Below LOW recommendation = below 40% likelihood
      - At/above LOW = normal calculation up to 100%
  
  2. Notes
    - This gives more accurate and fair scoring
    - Customers offering at or above the LOW recommendation get fair treatment
    - Very low offers are properly penalized
*/

CREATE OR REPLACE FUNCTION calculate_booking_likelihood(
  p_distance_km numeric,
  p_cargo_size text,
  p_urgency_hours numeric,
  p_customer_offer_ttd numeric,
  p_recommended_mid_ttd numeric,
  p_recommended_low_ttd numeric DEFAULT NULL
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

  -- Determine recommended low (use parameter if provided, otherwise calculate as 85% of mid)
  IF p_recommended_low_ttd IS NOT NULL AND p_recommended_low_ttd > 0 THEN
    recommended_low := p_recommended_low_ttd;
  ELSE
    recommended_low := p_recommended_mid_ttd * 0.85;
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

  -- Calculate price ratio and determine price score
  IF p_recommended_mid_ttd <= 0 THEN
    -- Fallback if recommended mid is invalid
    IF p_customer_offer_ttd >= 100 THEN
      price_score := 30;
      price_ratio := 1.0;
    ELSIF p_customer_offer_ttd >= 50 THEN
      price_score := 20;
      price_ratio := 0.7;
    ELSE
      price_score := 5;
      price_ratio := 0.3;
    END IF;
  ELSE
    -- Calculate price ratio
    price_ratio := p_customer_offer_ttd / p_recommended_mid_ttd;
    
    -- Price scoring with heavy penalties for low offers
    IF price_ratio >= 1.2 THEN
      price_score := 35;
    ELSIF price_ratio >= 1.0 THEN
      price_score := 30;
    ELSIF price_ratio >= 0.9 THEN
      price_score := 22;
    ELSIF price_ratio >= 0.8 THEN
      price_score := 15;
    ELSIF price_ratio >= 0.7 THEN
      price_score := 10;
    ELSIF price_ratio >= 0.5 THEN
      price_score := 5;
    ELSE
      -- Very low price (< 50% of recommended)
      price_score := 2;
    END IF;
  END IF;

  -- Apply price-based caps using actual recommended LOW price
  IF p_customer_offer_ttd < (recommended_low * 0.5) THEN
    -- Extremely low price (less than 50% of LOW): cap at 20%
    total_score := LEAST(base_score + price_score, 20);
  ELSIF p_customer_offer_ttd < recommended_low THEN
    -- Below recommended LOW: cap at 39% (below 40%)
    total_score := LEAST(base_score + price_score, 39);
  ELSE
    -- At or above recommended LOW: normal calculation
    total_score := LEAST(base_score + price_score, 100);
  END IF;

  -- Determine label based on total score
  IF total_score >= 80 THEN
    likelihood_label := 'Excellent chance of pickup';
  ELSIF total_score >= 70 THEN
    likelihood_label := 'High chance of pickup';
  ELSIF total_score >= 50 THEN
    likelihood_label := 'Good chance of pickup';
  ELSIF total_score >= 30 THEN
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