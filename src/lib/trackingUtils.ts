interface Job {
  id: string;
  status: string;
  assigned_courier_id: string | null;
  delivery_stops?: Array<{
    stop_type: 'PICKUP' | 'DROPOFF';
    status: 'NOT_STARTED' | 'ENROUTE' | 'ARRIVED' | 'COMPLETED';
  }>;
}

export function isTrackingActive(job: Job): boolean {
  if (!job.assigned_courier_id) {
    return false;
  }

  if (job.status === 'completed' || job.status === 'cancelled') {
    return false;
  }

  if (job.status === 'returning') {
    return true;
  }

  if (!job.delivery_stops || job.delivery_stops.length === 0) {
    return job.status === 'in_transit';
  }

  const pickupStops = job.delivery_stops.filter(s => s.stop_type === 'PICKUP');

  if (pickupStops.length === 0) {
    return job.status === 'in_transit';
  }

  const allPickupsCollected = pickupStops.every(s => s.status === 'COMPLETED');

  return allPickupsCollected && (job.status === 'accepted' || job.status === 'in_transit');
}

export function getTrackingStatus(job: Job): 'not_started' | 'active' | 'ended' {
  if (job.status === 'completed' || job.status === 'cancelled') {
    return 'ended';
  }

  if (isTrackingActive(job)) {
    return 'active';
  }

  return 'not_started';
}

export function shouldShowTrackingCard(job: Job, isCustomerOrRetail: boolean): boolean {
  if (!isCustomerOrRetail) {
    return false;
  }

  return isTrackingActive(job);
}
