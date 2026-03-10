import { supabase } from './supabase';

export interface DetentionTier {
  minutes: number;
  baseFee: number;
  label: string;
  tierKey: 'tier_1' | 'tier_2' | 'tier_3';
}

export const DETENTION_TIERS: DetentionTier[] = [
  { minutes: 15, baseFee: 50, label: '15 min', tierKey: 'tier_1' },
  { minutes: 25, baseFee: 75, label: '25 min', tierKey: 'tier_2' },
  { minutes: 45, baseFee: 100, label: '45 min', tierKey: 'tier_3' },
];

export const FREE_MINUTES = 15;

const VEHICLE_MULTIPLIERS: Record<string, number> = {
  motorcycle: 0.8,
  car: 1.0,
  van: 1.3,
  pickup_truck: 1.3,
  truck: 1.6,
  box_truck: 1.6,
  flatbed: 1.8,
  refrigerated_truck: 1.8,
  reefer: 1.8,
  tipper: 1.6,
  lowboy: 2.0,
  tanker: 1.8,
};

function getVehicleMultiplier(vehicleType: string): number {
  const normalized = vehicleType.toLowerCase().replace(/\s+/g, '_').replace(/[()]/g, '');
  return VEHICLE_MULTIPLIERS[normalized] || 1.0;
}

function getJobPriceMultiplier(basePrice: number): number {
  if (basePrice >= 2000) return 1.5;
  if (basePrice >= 1000) return 1.3;
  if (basePrice >= 500) return 1.15;
  return 1.0;
}

export function calculateDetentionFee(
  waitMinutes: number,
  vehicleType: string,
  jobBasePrice: number
): { fee: number; tier: string; billableMinutes: number } {
  if (waitMinutes <= FREE_MINUTES) {
    return { fee: 0, tier: 'none', billableMinutes: 0 };
  }

  const billableMinutes = waitMinutes - FREE_MINUTES;
  const vehicleMult = getVehicleMultiplier(vehicleType);
  const priceMult = getJobPriceMultiplier(jobBasePrice);

  let baseFee = 0;
  let tier = 'none';

  if (waitMinutes >= 45) {
    baseFee = 100;
    tier = 'tier_3';
  } else if (waitMinutes >= 25) {
    baseFee = 75;
    tier = 'tier_2';
  } else {
    baseFee = 50;
    tier = 'tier_1';
  }

  const fee = Math.round(baseFee * vehicleMult * priceMult * 100) / 100;

  return { fee, tier, billableMinutes };
}

export function getCurrentTier(waitMinutes: number): DetentionTier | null {
  if (waitMinutes < FREE_MINUTES) return null;
  for (let i = DETENTION_TIERS.length - 1; i >= 0; i--) {
    if (waitMinutes >= DETENTION_TIERS[i].minutes) {
      return DETENTION_TIERS[i];
    }
  }
  return null;
}

export function getMinutesSinceArrival(arrivedAt: string): number {
  const arrival = new Date(arrivedAt).getTime();
  const now = Date.now();
  return Math.floor((now - arrival) / 60000);
}

export function formatWaitTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export async function createDetentionRecord(
  jobId: string,
  stopId: string,
  arrivedAt: string,
  vehicleType: string,
  jobBasePrice: number
): Promise<string | null> {
  const { data, error } = await supabase
    .from('detention_records')
    .insert({
      job_id: jobId,
      stop_id: stopId,
      arrived_at: arrivedAt,
      vehicle_type: vehicleType || 'car',
      job_base_price: jobBasePrice || 0,
      status: 'active',
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to create detention record:', error);
    return null;
  }
  return data.id;
}

export async function updateDetentionThreshold(
  recordId: string,
  waitMinutes: number,
  vehicleType: string,
  jobBasePrice: number
): Promise<void> {
  const { fee, tier } = calculateDetentionFee(waitMinutes, vehicleType, jobBasePrice);
  const billableMinutes = Math.max(0, waitMinutes - FREE_MINUTES);

  const update: Record<string, unknown> = {
    wait_minutes: waitMinutes,
    billable_minutes: billableMinutes,
    fee_amount: fee,
    tier_reached: tier,
    updated_at: new Date().toISOString(),
  };

  if (waitMinutes >= 15 && tier !== 'none') update.notified_tier_1 = true;
  if (waitMinutes >= 25) update.notified_tier_2 = true;
  if (waitMinutes >= 45) update.notified_tier_3 = true;

  const { error } = await supabase
    .from('detention_records')
    .update(update)
    .eq('id', recordId);

  if (error) {
    console.error('Failed to update detention threshold:', error);
  }
}

export async function finalizeDetention(
  recordId: string,
  jobId: string,
  waitMinutes: number,
  vehicleType: string,
  jobBasePrice: number
): Promise<number> {
  const { fee, tier } = calculateDetentionFee(waitMinutes, vehicleType, jobBasePrice);
  const billableMinutes = Math.max(0, waitMinutes - FREE_MINUTES);

  const { error: recordError } = await supabase
    .from('detention_records')
    .update({
      collected_at: new Date().toISOString(),
      wait_minutes: waitMinutes,
      billable_minutes: billableMinutes,
      fee_amount: fee,
      tier_reached: tier,
      status: 'finalized',
      notified_tier_1: waitMinutes >= 15,
      notified_tier_2: waitMinutes >= 25,
      notified_tier_3: waitMinutes >= 45,
      updated_at: new Date().toISOString(),
    })
    .eq('id', recordId);

  if (recordError) {
    console.error('Failed to finalize detention record:', recordError);
    return 0;
  }

  if (fee > 0) {
    const { data: jobData } = await supabase
      .from('jobs')
      .select('detention_fee, total_price, courier_earnings')
      .eq('id', jobId)
      .maybeSingle();

    const currentDetention = jobData?.detention_fee || 0;
    const currentTotal = jobData?.total_price || 0;
    const currentEarnings = jobData?.courier_earnings || 0;

    const { error: jobError } = await supabase
      .from('jobs')
      .update({
        detention_fee: currentDetention + fee,
        total_price: currentTotal + fee,
        courier_earnings: currentEarnings + fee,
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (jobError) {
      console.error('Failed to update job detention fee:', jobError);
    }
  }

  return fee;
}

export async function getActiveDetentionRecord(
  jobId: string,
  stopId: string
): Promise<{ id: string; arrived_at: string; vehicle_type: string; job_base_price: number } | null> {
  const { data, error } = await supabase
    .from('detention_records')
    .select('id, arrived_at, vehicle_type, job_base_price')
    .eq('job_id', jobId)
    .eq('stop_id', stopId)
    .eq('status', 'active')
    .maybeSingle();

  if (error || !data) return null;
  return data;
}
