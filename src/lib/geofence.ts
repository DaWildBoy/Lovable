const GEOFENCE_RADIUS_METERS = 100;

const OFFLINE_QUEUE_KEY = 'moveme_geofence_offline_queue';

export interface GeofenceTarget {
  lat: number;
  lng: number;
}

export interface OfflineArrivalPayload {
  jobId: string;
  stopId: string;
  stopType: 'PICKUP' | 'DROPOFF';
  status: 'ARRIVED';
  timestamp: string;
  lat: number;
  lng: number;
  offline: true;
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export function isInsideGeofence(
  driverLat: number,
  driverLng: number,
  target: GeofenceTarget,
  radiusMeters: number = GEOFENCE_RADIUS_METERS
): boolean {
  const distance = haversineDistance(driverLat, driverLng, target.lat, target.lng);
  return distance <= radiusMeters;
}

export function getDistanceToTarget(
  driverLat: number,
  driverLng: number,
  target: GeofenceTarget
): number {
  return Math.round(haversineDistance(driverLat, driverLng, target.lat, target.lng));
}

export function getOfflineQueue(): OfflineArrivalPayload[] {
  try {
    const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addToOfflineQueue(payload: OfflineArrivalPayload): void {
  const queue = getOfflineQueue();
  const exists = queue.some(
    (item) => item.jobId === payload.jobId && item.stopId === payload.stopId
  );
  if (!exists) {
    queue.push(payload);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
  }
}

export function removeFromOfflineQueue(jobId: string, stopId: string): void {
  const queue = getOfflineQueue().filter(
    (item) => !(item.jobId === jobId && item.stopId === stopId)
  );
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
}

export function clearOfflineQueue(): void {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      maximumAge: 5000,
      timeout: 10000,
    });
  });
}

export function watchPosition(
  onUpdate: (pos: GeolocationPosition) => void,
  onError?: (err: GeolocationPositionError) => void
): number | null {
  if (!navigator.geolocation) return null;

  return navigator.geolocation.watchPosition(onUpdate, onError, {
    enableHighAccuracy: true,
    maximumAge: 3000,
    timeout: 15000,
  });
}

export function stopWatching(watchId: number | null): void {
  if (watchId !== null && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
}
