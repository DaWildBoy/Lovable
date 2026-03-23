import { supabase } from './supabase';

export interface PriceRecommendation {
  low: number;
  mid: number;
  high: number;
}

export interface BookingLikelihood {
  score: number;
  label: string;
  breakdown: {
    distance: number;
    cargo: number;
    urgency: number;
    price: number;
  };
}

export interface PaymentBreakdown {
  basePrice: number;
  platformFee: number;
  vatAmount: number;
  totalPrice: number;
  courierEarnings: number;
}

export interface CustomerFeeBreakdown {
  baseFare: number;
  platformFee: number;
  vatAmount: number;
  customerTotal: number;
}

export interface DriverFeeBreakdown {
  baseFare: number;
  platformFee: number;
  netEarnings: number;
}

export interface PlatformRevenueBreakdown {
  customerServiceFee: number;
  driverPlatformFee: number;
  totalPlatformRevenue: number;
}

export const DEFAULT_PLATFORM_FEE = 0.075;
export const SERVICE_FEE_PERCENTAGE = 0.075;
export const VAT_PERCENTAGE = 0.125;

let _cachedFee: number | null = null;
let _feePromise: Promise<number> | null = null;

export async function fetchPlatformFeePercentage(): Promise<number> {
  if (_cachedFee !== null) return _cachedFee;
  if (_feePromise) return _feePromise;

  _feePromise = (async () => {
    try {
      const { data } = await supabase
        .from('platform_settings')
        .select('value')
        .eq('key', 'platform_commission_percent')
        .maybeSingle();

      if (data?.value) {
        const parsed = parseFloat(data.value);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          _cachedFee = parsed / 100;
          return _cachedFee;
        }
      }
    } catch {
      // Fall back to default
    }
    _cachedFee = DEFAULT_PLATFORM_FEE;
    return _cachedFee;
  })();

  const result = await _feePromise;
  _feePromise = null;
  return result;
}

export function resetPlatformFeeCache() {
  _cachedFee = null;
  _feePromise = null;
}

export interface PriceRecommendationParams {
  distanceKm: number;
  cargoSize: 'small' | 'medium' | 'large';
  urgencyHours: number;
  cargoCount?: number;
  totalWeightKg?: number;
  numStops?: number;
  jobType?: string;
  isFragile?: boolean;
  requiresHeavyLift?: boolean;
  needsCover?: boolean;
  hasSecurityGate?: boolean;
  totalVolumeCm3?: number;
  declaredCargoValue?: number;
  cargoInsuranceEnabled?: boolean;
}

export async function calculatePriceRecommendation(
  distanceKmOrParams: number | PriceRecommendationParams,
  cargoSize?: 'small' | 'medium' | 'large',
  urgencyHours?: number,
  cargoCount: number = 1,
  totalWeightKg: number = 0,
  numStops: number = 1
): Promise<PriceRecommendation> {
  let params: Record<string, unknown>;

  if (typeof distanceKmOrParams === 'object') {
    const p = distanceKmOrParams;
    params = {
      p_distance_km: p.distanceKm,
      p_cargo_size: p.cargoSize,
      p_urgency_hours: p.urgencyHours,
      p_cargo_count: p.cargoCount ?? 1,
      p_total_weight_kg: p.totalWeightKg ?? 0,
      p_num_stops: p.numStops ?? 1,
      p_job_type: p.jobType ?? 'standard',
      p_is_fragile: p.isFragile ?? false,
      p_requires_heavy_lift: p.requiresHeavyLift ?? false,
      p_needs_cover: p.needsCover ?? false,
      p_has_security_gate: p.hasSecurityGate ?? false,
      p_total_volume_cm3: p.totalVolumeCm3 ?? 0,
      p_declared_cargo_value: p.declaredCargoValue ?? 0,
      p_cargo_insurance_enabled: p.cargoInsuranceEnabled ?? false,
    };
  } else {
    params = {
      p_distance_km: distanceKmOrParams,
      p_cargo_size: cargoSize,
      p_urgency_hours: urgencyHours,
      p_cargo_count: cargoCount,
      p_total_weight_kg: totalWeightKg,
      p_num_stops: numStops,
    };
  }

  const { data, error } = await supabase.rpc('calculate_price_recommendation', params);

  if (error) throw error;
  return data as PriceRecommendation;
}

export interface BookingLikelihoodParams {
  distanceKm: number;
  cargoSize: 'small' | 'medium' | 'large';
  urgencyHours: number;
  customerOfferTTD: number;
  recommendedMidTTD: number;
  recommendedLowTTD?: number;
  recommendedHighTTD?: number;
  cargoCount?: number;
  numStops?: number;
  jobType?: string;
  isFragile?: boolean;
  requiresHeavyLift?: boolean;
}

export async function calculateBookingLikelihood(
  distanceKmOrParams: number | BookingLikelihoodParams,
  cargoSize?: 'small' | 'medium' | 'large',
  urgencyHours?: number,
  customerOfferTTD?: number,
  recommendedMidTTD?: number,
  recommendedLowTTD?: number,
  recommendedHighTTD?: number,
  cargoCount: number = 1,
  numStops: number = 1
): Promise<BookingLikelihood> {
  let params: Record<string, unknown>;

  if (typeof distanceKmOrParams === 'object') {
    const p = distanceKmOrParams;
    params = {
      p_distance_km: p.distanceKm,
      p_cargo_size: p.cargoSize,
      p_urgency_hours: p.urgencyHours,
      p_customer_offer_ttd: p.customerOfferTTD,
      p_recommended_mid_ttd: p.recommendedMidTTD,
      p_recommended_low_ttd: p.recommendedLowTTD,
      p_recommended_high_ttd: p.recommendedHighTTD,
      p_cargo_count: p.cargoCount ?? 1,
      p_num_stops: p.numStops ?? 1,
      p_job_type: p.jobType ?? 'standard',
      p_is_fragile: p.isFragile ?? false,
      p_requires_heavy_lift: p.requiresHeavyLift ?? false,
    };
  } else {
    params = {
      p_distance_km: distanceKmOrParams,
      p_cargo_size: cargoSize,
      p_urgency_hours: urgencyHours,
      p_customer_offer_ttd: customerOfferTTD,
      p_recommended_mid_ttd: recommendedMidTTD,
      p_recommended_low_ttd: recommendedLowTTD,
      p_recommended_high_ttd: recommendedHighTTD,
      p_cargo_count: cargoCount,
      p_num_stops: numStops,
    };
  }

  const { data, error } = await supabase.rpc('calculate_booking_likelihood', params);

  if (error) throw error;
  return data as BookingLikelihood;
}

export function calculatePaymentBreakdown(basePrice: number, feeRate = DEFAULT_PLATFORM_FEE): PaymentBreakdown {
  const platformFee = Math.round(basePrice * feeRate * 100) / 100;
  const vatAmount = Math.round(basePrice * VAT_PERCENTAGE * 100) / 100;
  const totalPrice = Math.round((basePrice + platformFee + vatAmount) * 100) / 100;
  const courierEarnings = basePrice;

  return {
    basePrice,
    platformFee,
    vatAmount,
    totalPrice,
    courierEarnings
  };
}

export function calculateCustomerFees(baseFare: number, feeRate = DEFAULT_PLATFORM_FEE): CustomerFeeBreakdown {
  const platformFee = Math.round(baseFare * feeRate * 100) / 100;
  const vatAmount = Math.round(baseFare * VAT_PERCENTAGE * 100) / 100;
  const customerTotal = Math.round((baseFare + platformFee + vatAmount) * 100) / 100;
  return { baseFare, platformFee, vatAmount, customerTotal };
}

export function calculateDriverFees(baseFare: number, feeRate = DEFAULT_PLATFORM_FEE): DriverFeeBreakdown {
  const platformFee = Math.round(baseFare * feeRate * 100) / 100;
  const netEarnings = Math.round((baseFare - platformFee) * 100) / 100;
  return { baseFare, platformFee, netEarnings };
}

export function calculatePlatformRevenue(baseFare: number, feeRate = DEFAULT_PLATFORM_FEE): PlatformRevenueBreakdown {
  const customerServiceFee = Math.round(baseFare * (feeRate + VAT_PERCENTAGE) * 100) / 100;
  const driverPlatformFee = Math.round(baseFare * feeRate * 100) / 100;
  const totalPlatformRevenue = Math.round((customerServiceFee + driverPlatformFee) * 100) / 100;
  return { customerServiceFee, driverPlatformFee, totalPlatformRevenue };
}

export const RETURN_FEE_PERCENTAGE = 0.50;

export interface ReturnFeeBreakdown {
  baseTransportCost: number;
  returnFee: number;
  returnPlatformFee: number;
  returnDriverPayout: number;
  updatedDriverNetEarnings: number;
  updatedCustomerTotal: number;
}

export function calculateReturnFee(
  baseTransportCost: number,
  originalDriverNetEarnings: number,
  originalCustomerTotal: number
): ReturnFeeBreakdown {
  const returnFee = Math.round(baseTransportCost * RETURN_FEE_PERCENTAGE * 100) / 100;
  const returnPlatformFee = 0;
  const returnDriverPayout = returnFee;
  const updatedDriverNetEarnings = Math.round((originalDriverNetEarnings + returnDriverPayout) * 100) / 100;
  const updatedCustomerTotal = Math.round((originalCustomerTotal + returnFee) * 100) / 100;

  return {
    baseTransportCost,
    returnFee,
    returnPlatformFee,
    returnDriverPayout,
    updatedDriverNetEarnings,
    updatedCustomerTotal,
  };
}

export function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)} TTD`;
}
