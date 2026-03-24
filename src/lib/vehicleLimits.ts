import { supabase } from './supabase';
import { haversineDistance } from './geofence';

export type VehicleClass = 'heavy_freight' | 'courier_class';

const ACTIVE_JOB_STATUSES = [
  'assigned', 'queued_next', 'on_way_to_pickup', 'arrived_waiting',
  'loading_cargo', 'cargo_collected', 'in_transit', 'delivered'
];

const DIRECTIONAL_RADIUS_METERS = 5000;
const DETOUR_THRESHOLD_METERS = 2000;
const DETOUR_TIME_THRESHOLD_MS = 5 * 60 * 1000;
const ETA_GRACE_MINUTES = 15;
const RATING_PENALTY = 0.2;
const MIN_RATING_FOR_MULTI_JOBS = 4.5;

export function getVehicleClass(vehicleType: string | null): VehicleClass {
  if (!vehicleType) return 'courier_class';
  const type = vehicleType.toLowerCase();
  if (type === 'truck' || type === 'fleet' || type === '3-ton' || type === 'hiab' || type === 'pickup') {
    return 'heavy_freight';
  }
  return 'courier_class';
}

export function getMaxActiveJobs(vehicleClass: VehicleClass, canAcceptMultiple: boolean): number {
  if (vehicleClass === 'heavy_freight') return 1;
  if (!canAcceptMultiple) return 1;
  return 2;
}

export async function getActiveCourierJobCount(courierId: string): Promise<number> {
  const { count } = await supabase
    .from('jobs')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_courier_id', courierId)
    .in('status', ACTIVE_JOB_STATUSES);

  return count || 0;
}

export async function getActiveCourierJobs(courierId: string): Promise<Array<{
  id: string;
  status: string;
  dropoff_location_lat: number | null;
  dropoff_location_lng: number | null;
  pickup_location_lat: number | null;
  pickup_location_lng: number | null;
}>> {
  const { data } = await supabase
    .from('jobs')
    .select('id, status, dropoff_location_lat, dropoff_location_lng, pickup_location_lat, pickup_location_lng')
    .eq('assigned_courier_id', courierId)
    .in('status', ACTIVE_JOB_STATUSES);

  return data || [];
}

export function isWithinDirectionalRadius(
  firstJobDropoffLat: number,
  firstJobDropoffLng: number,
  secondJobPickupLat: number,
  secondJobPickupLng: number
): boolean {
  const distance = haversineDistance(
    firstJobDropoffLat,
    firstJobDropoffLng,
    secondJobPickupLat,
    secondJobPickupLng
  );
  return distance <= DIRECTIONAL_RADIUS_METERS;
}

export interface JobAcceptanceCheck {
  canAccept: boolean;
  shouldQueue: boolean;
  reason?: string;
}

export async function checkJobAcceptance(
  courierId: string,
  vehicleClass: VehicleClass,
  canAcceptMultiple: boolean,
  newJobPickupLat?: number | null,
  newJobPickupLng?: number | null
): Promise<JobAcceptanceCheck> {
  const maxJobs = getMaxActiveJobs(vehicleClass, canAcceptMultiple);
  const activeJobs = await getActiveCourierJobs(courierId);
  const activeCount = activeJobs.length;

  if (activeCount === 0) {
    return { canAccept: true, shouldQueue: false };
  }

  if (activeCount >= maxJobs) {
    if (vehicleClass === 'heavy_freight') {
      return {
        canAccept: false,
        shouldQueue: false,
        reason: 'Heavy freight vehicles can only handle 1 active job at a time.'
      };
    }
    return {
      canAccept: false,
      shouldQueue: false,
      reason: `You have reached the maximum of ${maxJobs} active job${maxJobs > 1 ? 's' : ''}.`
    };
  }

  if (vehicleClass === 'courier_class' && activeCount === 1 && newJobPickupLat && newJobPickupLng) {
    const firstJob = activeJobs[0];
    if (firstJob.dropoff_location_lat && firstJob.dropoff_location_lng) {
      const withinRadius = isWithinDirectionalRadius(
        firstJob.dropoff_location_lat,
        firstJob.dropoff_location_lng,
        newJobPickupLat,
        newJobPickupLng
      );

      if (!withinRadius) {
        return {
          canAccept: false,
          shouldQueue: false,
          reason: 'This job\'s pickup is more than 5km from your current delivery destination.'
        };
      }
    }

    return { canAccept: true, shouldQueue: true };
  }

  return { canAccept: true, shouldQueue: activeCount > 0 };
}

export async function transitionQueuedJob(courierId: string): Promise<string | null> {
  const { data: queuedJobs } = await supabase
    .from('jobs')
    .select('id')
    .eq('assigned_courier_id', courierId)
    .eq('status', 'queued_next')
    .order('queue_position', { ascending: true })
    .limit(1);

  if (!queuedJobs || queuedJobs.length === 0) return null;

  const jobId = queuedJobs[0].id;

  const { error } = await supabase
    .from('jobs')
    .update({
      status: 'assigned',
      queue_position: 1,
      updated_at: new Date().toISOString()
    })
    .eq('id', jobId);

  if (error) {
    console.error('Failed to transition queued job:', error);
    return null;
  }

  return jobId;
}

export interface DeviationCheck {
  isDetour: boolean;
  distanceFromRoute: number;
}

export function checkRouteDeviation(
  driverLat: number,
  driverLng: number,
  routePointLat: number,
  routePointLng: number
): DeviationCheck {
  const distance = haversineDistance(driverLat, driverLng, routePointLat, routePointLng);
  return {
    isDetour: distance > DETOUR_THRESHOLD_METERS,
    distanceFromRoute: distance
  };
}

export interface ETAViolation {
  isViolation: boolean;
  minutesOver: number;
}

export function checkETAViolation(
  expectedMinutes: number,
  acceptedAt: string,
  arrivedAt: string
): ETAViolation {
  const acceptTime = new Date(acceptedAt).getTime();
  const arriveTime = new Date(arrivedAt).getTime();
  const actualMinutes = (arriveTime - acceptTime) / 60000;
  const threshold = expectedMinutes + ETA_GRACE_MINUTES;
  const minutesOver = actualMinutes - threshold;

  return {
    isViolation: minutesOver > 0,
    minutesOver: Math.max(0, Math.round(minutesOver))
  };
}

export async function applyETAPenalty(
  driverUserId: string,
  jobId: string,
  courierId: string,
  expectedMinutes: number,
  actualMinutes: number,
  driverLat?: number,
  driverLng?: number
): Promise<void> {
  await supabase.from('eta_deviation_logs').insert({
    job_id: jobId,
    courier_id: courierId,
    driver_user_id: driverUserId,
    deviation_type: 'late_arrival',
    expected_eta_minutes: expectedMinutes,
    actual_arrival_minutes: Math.round(actualMinutes),
    penalty_applied: true,
    rating_deducted: RATING_PENALTY,
    driver_lat: driverLat,
    driver_lng: driverLng,
  });

  const { data: profile } = await supabase
    .from('profiles')
    .select('rating_average, rating_count')
    .eq('id', driverUserId)
    .maybeSingle();

  if (profile && profile.rating_average !== null) {
    const newRating = Math.max(1, (profile.rating_average || 5) - RATING_PENALTY);

    const updateData: Record<string, unknown> = { rating_average: newRating };

    if (newRating < MIN_RATING_FOR_MULTI_JOBS) {
      await supabase
        .from('couriers')
        .update({ can_accept_multiple_jobs: false })
        .eq('user_id', driverUserId);
    }

    await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', driverUserId);
  }
}

export async function logDetourEvent(
  jobId: string,
  courierId: string,
  driverUserId: string,
  distanceMeters: number,
  durationSeconds: number,
  driverLat: number,
  driverLng: number,
  routeLat: number,
  routeLng: number
): Promise<void> {
  await supabase.from('eta_deviation_logs').insert({
    job_id: jobId,
    courier_id: courierId,
    driver_user_id: driverUserId,
    deviation_type: 'unauthorized_detour',
    deviation_distance_meters: distanceMeters,
    deviation_duration_seconds: durationSeconds,
    penalty_applied: false,
    driver_lat: driverLat,
    driver_lng: driverLng,
    route_lat: routeLat,
    route_lng: routeLng,
  });

  await supabase
    .from('jobs')
    .update({
      detour_flagged: true,
      detour_flagged_at: new Date().toISOString()
    })
    .eq('id', jobId);
}

export { DETOUR_THRESHOLD_METERS, DETOUR_TIME_THRESHOLD_MS, ETA_GRACE_MINUTES, RATING_PENALTY, MIN_RATING_FOR_MULTI_JOBS, ACTIVE_JOB_STATUSES };
