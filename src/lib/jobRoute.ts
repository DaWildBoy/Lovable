import { Database } from './database.types';

type Job = Database['public']['Tables']['jobs']['Row'];

export interface RouteStop {
  id: string;
  address: string;
  lat: number;
  lng: number;
  label?: string;
  type: 'pickup' | 'dropoff';
  orderIndex?: number;
}

export interface PickupGroup {
  pickup: RouteStop;
  dropoffs: RouteStop[];
}

export interface NormalizedRoute {
  isMultiStop: boolean;
  hasMultiplePickups: boolean;
  pickups: RouteStop[];
  dropoffs: RouteStop[];
  pickupGroups: PickupGroup[];
  allStops: RouteStop[];
  totalDistance: number;
  etaMinutes: number | null;
}

export function buildRouteFromJob(job: Job): NormalizedRoute {
  const isMultiStop = job.is_multi_stop || false;
  const hasMultiplePickups = job.has_multiple_pickups || false;

  if (isMultiStop) {
    const pickupsData = typeof job.pickups === 'string'
      ? JSON.parse(job.pickups)
      : Array.isArray(job.pickups) ? job.pickups : [];

    const dropoffsData = typeof job.dropoffs === 'string'
      ? JSON.parse(job.dropoffs)
      : Array.isArray(job.dropoffs) ? job.dropoffs : [];

    const pickups: RouteStop[] = pickupsData.map((p: any, index: number) => ({
      id: p.id || `pickup-${index}`,
      address: p.address || '',
      lat: p.lat || 0,
      lng: p.lng || 0,
      label: p.label || `Pickup ${index + 1}`,
      type: 'pickup' as const,
    }));

    const dropoffs: RouteStop[] = dropoffsData
      .sort((a: any, b: any) => (a.orderIndex || 0) - (b.orderIndex || 0))
      .map((d: any, index: number) => ({
        id: d.id || `dropoff-${index}`,
        address: d.address || '',
        lat: d.lat || 0,
        lng: d.lng || 0,
        label: d.label || `Stop ${index + 1}`,
        type: 'dropoff' as const,
        orderIndex: d.orderIndex !== undefined ? d.orderIndex : index,
      }));

    const pickupGroups: PickupGroup[] = [];

    if (hasMultiplePickups && pickups.length > 0) {
      pickups.forEach((pickup, pickupIdx) => {
        const pickupLabel = `P${pickupIdx + 1}`;
        const groupDropoffs = dropoffs.filter(d =>
          d.label && (d.label.startsWith(pickupLabel + ' ') || d.label.startsWith(pickupLabel))
        ).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
        pickupGroups.push({
          pickup,
          dropoffs: groupDropoffs
        });
      });
    } else if (pickups.length > 0) {
      pickupGroups.push({
        pickup: pickups[0],
        dropoffs: dropoffs.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0))
      });
    }

    const allStops: RouteStop[] = [...pickups, ...dropoffs];

    return {
      isMultiStop: true,
      hasMultiplePickups,
      pickups,
      dropoffs,
      pickupGroups,
      allStops,
      totalDistance: job.total_distance_km || job.distance_km || 0,
      etaMinutes: job.eta_minutes,
    };
  } else {
    const pickup: RouteStop = {
      id: 'pickup-single',
      address: job.pickup_location_text || '',
      lat: job.pickup_lat || 0,
      lng: job.pickup_lng || 0,
      label: 'Pickup',
      type: 'pickup',
    };

    const dropoff: RouteStop = {
      id: 'dropoff-single',
      address: job.dropoff_location_text || '',
      lat: job.dropoff_lat || 0,
      lng: job.dropoff_lng || 0,
      label: 'Drop-off',
      type: 'dropoff',
    };

    return {
      isMultiStop: false,
      hasMultiplePickups: false,
      pickups: [pickup],
      dropoffs: [dropoff],
      pickupGroups: [{
        pickup,
        dropoffs: [dropoff]
      }],
      allStops: [pickup, dropoff],
      totalDistance: job.distance_km || 0,
      etaMinutes: job.eta_minutes,
    };
  }
}

export function formatProofOfDelivery(proofType: string | null): string {
  if (!proofType) return 'Not specified';

  const type = proofType.toUpperCase();
  switch (type) {
    case 'PHOTO':
      return 'Photo required';
    case 'SIGNATURE':
      return 'E-signature required (Mobile only)';
    case 'PHOTO_AND_SIGNATURE':
      return 'Photo and e-signature required';
    case 'NONE':
      return 'No proof required';
    default:
      return proofType;
  }
}

export function requiresESignature(proofType: string | null): boolean {
  if (!proofType) return false;
  const type = proofType.toUpperCase();
  return type === 'SIGNATURE' || type === 'PHOTO_AND_SIGNATURE';
}

export function requiresPhoto(proofType: string | null): boolean {
  if (!proofType) return false;
  const type = proofType.toUpperCase();
  return type === 'PHOTO' || type === 'PHOTO_AND_SIGNATURE';
}
