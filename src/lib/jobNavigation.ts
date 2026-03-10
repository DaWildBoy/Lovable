import { Database } from './database.types';

type Job = Database['public']['Tables']['jobs']['Row'];
type DeliveryStop = Database['public']['Tables']['delivery_stops']['Row'];
type CargoItem = Database['public']['Tables']['cargo_items']['Row'];
type PODStop = {
  id: string;
  stop_id: string;
  photo_urls: string[];
  signature_image_url: string | null;
  status: string;
  required_type: string;
};

export interface NavigationTarget {
  type: 'PICKUP' | 'DROPOFF' | 'COMPLETED';
  stopId?: string;
  location: {
    lat: number;
    lng: number;
    text: string;
  };
  label: string;
  stopNumber?: number;
}

export interface CurrentStep {
  type: 'PICKUP' | 'DROPOFF' | 'FINISH' | 'SELECT_STOP';
  id: string | null;
  stopObject: DeliveryStop | null;
  title: string;
  primaryLabel: string;
  address: string;
  contactName?: string;
  contactPhone?: string;
  location: {
    lat: number;
    lng: number;
    text: string;
  };
  stopNumber?: number;
  currentStatus: 'NOT_STARTED' | 'ENROUTE' | 'ARRIVED' | 'COMPLETED';
  availableActions: ('ENROUTE' | 'ARRIVED' | 'COLLECTED' | 'DELIVERED')[];
  podRequired: string;
  podStatus?: string;
  canComplete: boolean;
}

export interface StopOption {
  stopId: string;
  stopNumber: number;
  address: string;
  cargoSummary: string;
  cargoItems: CargoItem[];
}

export function getNextNavigationTarget(
  job: Job & { delivery_stops?: DeliveryStop[] },
  routeType: 'FIXED' | 'FLEXIBLE',
  currentSelectedStopId?: string | null
): NavigationTarget | null {
  if (!job.delivery_stops || job.delivery_stops.length === 0) {
    return null;
  }

  const stops = job.delivery_stops;

  // Find pickups and dropoffs
  const pickups = stops
    .filter(s => s.stop_type === 'PICKUP')
    .sort((a, b) => a.stop_order - b.stop_order);

  const dropoffs = stops
    .filter(s => s.stop_type === 'DROPOFF')
    .sort((a, b) => a.stop_order - b.stop_order);

  // Check if all pickups are collected
  const allPickupsCollected = pickups.every(p => p.status === 'COMPLETED');

  // If not all pickups collected, navigate to next pickup
  if (!allPickupsCollected) {
    const nextPickup = pickups.find(p => p.status !== 'COMPLETED');
    if (nextPickup) {
      return {
        type: 'PICKUP',
        stopId: nextPickup.id,
        location: {
          lat: nextPickup.location_lat,
          lng: nextPickup.location_lng,
          text: nextPickup.location_text,
        },
        label: `Pickup ${pickups.indexOf(nextPickup) + 1}`,
      };
    }
  }

  // Pickups are collected, now handle dropoffs based on route type
  if (routeType === 'FIXED') {
    // Auto-sequence: find first uncompleted dropoff
    const nextDropoff = dropoffs.find(d => d.status !== 'COMPLETED');
    if (nextDropoff) {
      const dropoffIndex = dropoffs.indexOf(nextDropoff);
      return {
        type: 'DROPOFF',
        stopId: nextDropoff.id,
        location: {
          lat: nextDropoff.location_lat,
          lng: nextDropoff.location_lng,
          text: nextDropoff.location_text,
        },
        label: `Stop ${dropoffIndex + 1}`,
        stopNumber: dropoffIndex + 1,
      };
    }
  } else if (routeType === 'FLEXIBLE') {
    // Use selected stop if available and not yet delivered
    if (currentSelectedStopId) {
      const selectedStop = dropoffs.find(
        d => d.id === currentSelectedStopId && d.status !== 'COMPLETED'
      );
      if (selectedStop) {
        const dropoffIndex = dropoffs.indexOf(selectedStop);
        return {
          type: 'DROPOFF',
          stopId: selectedStop.id,
          location: {
            lat: selectedStop.location_lat,
            lng: selectedStop.location_lng,
            text: selectedStop.location_text,
          },
          label: `Stop ${dropoffIndex + 1}`,
          stopNumber: dropoffIndex + 1,
        };
      }
    }
    // No selection or selected stop is completed - return null to prompt selection
    return null;
  }

  // All stops completed
  const allDropoffsCompleted = dropoffs.every(d => d.status === 'COMPLETED');
  if (allDropoffsCompleted) {
    return {
      type: 'COMPLETED',
      location: { lat: 0, lng: 0, text: '' },
      label: 'All stops completed',
    };
  }

  return null;
}

export function getAvailableStopOptions(
  job: Job & { delivery_stops?: DeliveryStop[]; cargo_items?: CargoItem[] }
): StopOption[] {
  if (!job.delivery_stops) return [];

  const dropoffs = job.delivery_stops
    .filter(s => s.stop_type === 'DROPOFF' && s.status !== 'COMPLETED')
    .sort((a, b) => a.stop_order - b.stop_order);

  return dropoffs.map((stop, idx) => {
    // Get cargo items for this stop
    const stopCargoItems = (job.cargo_items || []).filter(
      item => item.dropoff_stop_id === stop.id && item.status !== 'delivered'
    );

    // Build cargo summary
    let cargoSummary = '';
    if (stopCargoItems.length > 0) {
      const totalWeight = stopCargoItems.reduce(
        (sum, item) => sum + (Number(item.cargo_weight_kg) || 0),
        0
      );
      const itemCount = stopCargoItems.length;
      const categories = [...new Set(stopCargoItems.map(i => i.cargo_category))];

      cargoSummary = `${itemCount} item${itemCount !== 1 ? 's' : ''}`;
      if (categories.length > 0 && categories[0]) {
        cargoSummary += ` • ${categories[0] === 'other' ? stopCargoItems[0].cargo_category_custom || 'Items' : categories[0]}`;
      }
      if (totalWeight > 0) {
        cargoSummary += ` • ${totalWeight.toFixed(0)}kg`;
      }
    } else {
      cargoSummary = 'No items';
    }

    return {
      stopId: stop.id,
      stopNumber: idx + 1,
      address: stop.location_text,
      cargoSummary,
      cargoItems: stopCargoItems,
    };
  });
}

export function generateGoogleMapsUrl(target: NavigationTarget): string {
  if (target.type === 'COMPLETED') return '';

  // Prefer lat/lng if available
  if (target.location.lat && target.location.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${target.location.lat},${target.location.lng}`;
  }

  // Fallback to address
  const encodedAddress = encodeURIComponent(target.location.text);
  return `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`;
}

export function getCurrentStep(
  job: Job & { delivery_stops?: DeliveryStop[]; pod_stops?: PODStop[] },
  routeType: 'FIXED' | 'FLEXIBLE'
): CurrentStep {
  if (!job.delivery_stops || job.delivery_stops.length === 0) {
    return {
      type: 'FINISH',
      id: null,
      stopObject: null,
      title: 'No stops defined',
      primaryLabel: 'Complete Job',
      address: '',
      location: { lat: 0, lng: 0, text: '' },
      currentStatus: 'NOT_STARTED',
      availableActions: [],
      podRequired: 'NONE',
      canComplete: false,
    };
  }

  const stops = job.delivery_stops;
  const pickups = stops
    .filter(s => s.stop_type === 'PICKUP')
    .sort((a, b) => a.stop_order - b.stop_order);

  const dropoffs = stops
    .filter(s => s.stop_type === 'DROPOFF')
    .sort((a, b) => a.stop_order - b.stop_order);

  // A) Check for uncompleted pickups first
  const nextPickup = pickups.find(p => p.status !== 'COMPLETED');
  if (nextPickup) {
    const pickupIndex = pickups.indexOf(nextPickup);
    const pickupNumber = pickupIndex + 1;

    return {
      type: 'PICKUP',
      id: nextPickup.id,
      stopObject: nextPickup,
      title: `Pickup ${pickups.length > 1 ? `P${pickupNumber}` : ''}`,
      primaryLabel: `Go to Pickup${pickups.length > 1 ? ` P${pickupNumber}` : ''}`,
      address: nextPickup.location_text,
      contactName: nextPickup.contact_name || undefined,
      contactPhone: nextPickup.contact_phone || undefined,
      location: {
        lat: nextPickup.location_lat || 0,
        lng: nextPickup.location_lng || 0,
        text: nextPickup.location_text,
      },
      stopNumber: pickupNumber,
      currentStatus: nextPickup.status,
      availableActions: ['ENROUTE', 'ARRIVED', 'COLLECTED'],
      podRequired: 'NONE',
      canComplete: true,
    };
  }

  // B) All pickups collected, handle dropoffs based on route type
  if (routeType === 'FIXED') {
    const nextDropoff = dropoffs.find(d => d.status !== 'COMPLETED');
    if (nextDropoff) {
      const dropoffIndex = dropoffs.indexOf(nextDropoff);
      const dropoffNumber = dropoffIndex + 1;

      // Get POD info for this stop
      const podStop = job.pod_stops?.find(p => p.stop_id === nextDropoff.id);
      const podRequired = podStop?.required_type || job.proof_of_delivery_required || 'NONE';

      // Check if POD requirements are met
      let canComplete = true;
      if (podRequired !== 'NONE' && podStop) {
        if (podRequired === 'PHOTO' || podRequired === 'PHOTO_AND_SIGNATURE') {
          canComplete = canComplete && (podStop.photo_urls?.length > 0);
        }
        if (podRequired === 'SIGNATURE' || podRequired === 'PHOTO_AND_SIGNATURE') {
          canComplete = canComplete && !!podStop.signature_image_url;
        }
      }

      return {
        type: 'DROPOFF',
        id: nextDropoff.id,
        stopObject: nextDropoff,
        title: `Deliver Stop ${dropoffNumber}`,
        primaryLabel: `Deliver Stop ${dropoffNumber}`,
        address: nextDropoff.location_text,
        contactName: nextDropoff.contact_name || undefined,
        contactPhone: nextDropoff.contact_phone || undefined,
        location: {
          lat: nextDropoff.location_lat || 0,
          lng: nextDropoff.location_lng || 0,
          text: nextDropoff.location_text,
        },
        stopNumber: dropoffNumber,
        currentStatus: nextDropoff.status,
        availableActions: ['ENROUTE', 'ARRIVED', 'DELIVERED'],
        podRequired,
        podStatus: podStop?.status,
        canComplete,
      };
    }
  } else if (routeType === 'FLEXIBLE') {
    // Check if a stop is already selected
    if (job.current_selected_stop_id) {
      const selectedStop = dropoffs.find(
        d => d.id === job.current_selected_stop_id && d.status !== 'COMPLETED'
      );

      if (selectedStop) {
        const dropoffIndex = dropoffs.indexOf(selectedStop);
        const dropoffNumber = dropoffIndex + 1;

        const podStop = job.pod_stops?.find(p => p.stop_id === selectedStop.id);
        const podRequired = podStop?.required_type || job.proof_of_delivery_required || 'NONE';

        let canComplete = true;
        if (podRequired !== 'NONE' && podStop) {
          if (podRequired === 'PHOTO' || podRequired === 'PHOTO_AND_SIGNATURE') {
            canComplete = canComplete && (podStop.photo_urls?.length > 0);
          }
          if (podRequired === 'SIGNATURE' || podRequired === 'PHOTO_AND_SIGNATURE') {
            canComplete = canComplete && !!podStop.signature_image_url;
          }
        }

        return {
          type: 'DROPOFF',
          id: selectedStop.id,
          stopObject: selectedStop,
          title: `Deliver Stop ${dropoffNumber}`,
          primaryLabel: `Deliver Stop ${dropoffNumber}`,
          address: selectedStop.location_text,
          contactName: selectedStop.contact_name || undefined,
          contactPhone: selectedStop.contact_phone || undefined,
          location: {
            lat: selectedStop.location_lat || 0,
            lng: selectedStop.location_lng || 0,
            text: selectedStop.location_text,
          },
          stopNumber: dropoffNumber,
          currentStatus: selectedStop.status,
          availableActions: ['ENROUTE', 'ARRIVED', 'DELIVERED'],
          podRequired,
          podStatus: podStop?.status,
          canComplete,
        };
      }
    }

    // Need to select a stop
    const remainingDropoffs = dropoffs.filter(d => d.status !== 'COMPLETED');
    if (remainingDropoffs.length > 0) {
      return {
        type: 'SELECT_STOP',
        id: null,
        stopObject: null,
        title: 'Choose Next Delivery Stop',
        primaryLabel: 'Select Destination',
        address: '',
        location: { lat: 0, lng: 0, text: '' },
        currentStatus: 'NOT_STARTED',
        availableActions: [],
        podRequired: 'NONE',
        canComplete: false,
      };
    }
  }

  // C) All stops completed
  const allCompleted = dropoffs.every(d => d.status === 'COMPLETED');
  if (allCompleted) {
    return {
      type: 'FINISH',
      id: null,
      stopObject: null,
      title: 'All stops complete',
      primaryLabel: 'Complete Entire Job',
      address: '',
      location: { lat: 0, lng: 0, text: '' },
      currentStatus: 'COMPLETED',
      availableActions: [],
      podRequired: 'NONE',
      canComplete: true,
    };
  }

  // Fallback
  return {
    type: 'FINISH',
    id: null,
    stopObject: null,
    title: 'Ready to complete',
    primaryLabel: 'Complete Job',
    address: '',
    location: { lat: 0, lng: 0, text: '' },
    currentStatus: 'NOT_STARTED',
    availableActions: [],
    podRequired: 'NONE',
    canComplete: false,
  };
}
