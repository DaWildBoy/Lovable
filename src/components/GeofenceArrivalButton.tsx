import { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Loader2, WifiOff, MapPinOff, Navigation } from 'lucide-react';
import {
  isInsideGeofence,
  getDistanceToTarget,
  watchPosition,
  stopWatching,
  addToOfflineQueue,
  type GeofenceTarget,
  type OfflineArrivalPayload,
} from '../lib/geofence';
import { BadPinOverrideModal } from './BadPinOverrideModal';

interface GeofenceArrivalButtonProps {
  jobId: string;
  stopId: string;
  stopType: 'PICKUP' | 'DROPOFF';
  targetLat: number | null;
  targetLng: number | null;
  onArrive: (data: {
    jobId: string;
    stopId: string;
    stopType: string;
    lat: number;
    lng: number;
    offline: boolean;
    badPinOverride: boolean;
    badPinPhotoFile?: File;
  }) => void;
}

type GeofenceState =
  | 'loading'
  | 'no_gps'
  | 'outside'
  | 'inside'
  | 'no_target'
  | 'arrived_offline';

export function GeofenceArrivalButton({
  jobId,
  stopId,
  stopType,
  targetLat,
  targetLng,
  onArrive,
}: GeofenceArrivalButtonProps) {
  const [state, setState] = useState<GeofenceState>('loading');
  const [distance, setDistance] = useState<number | null>(null);
  const [driverPos, setDriverPos] = useState<{ lat: number; lng: number } | null>(null);
  const [showBadPinModal, setShowBadPinModal] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const arrivedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  const hasTarget = targetLat != null && targetLng != null;
  const target: GeofenceTarget | null = hasTarget
    ? { lat: targetLat!, lng: targetLng! }
    : null;

  const handleOnline = useCallback(() => setIsOnline(true), []);
  const handleOffline = useCallback(() => setIsOnline(false), []);

  useEffect(() => {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [handleOnline, handleOffline]);

  useEffect(() => {
    if (arrivedRef.current) return;

    if (!target) {
      setState('no_target');
      return;
    }

    const id = watchPosition(
      (pos) => {
        if (arrivedRef.current) return;

        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setDriverPos({ lat, lng });

        const dist = getDistanceToTarget(lat, lng, target);
        setDistance(dist);

        const inside = isInsideGeofence(lat, lng, target);

        if (inside && !navigator.onLine) {
          setState('arrived_offline');
          arrivedRef.current = true;

          const payload: OfflineArrivalPayload = {
            jobId,
            stopId,
            stopType,
            status: 'ARRIVED',
            timestamp: new Date().toISOString(),
            lat,
            lng,
            offline: true,
          };
          addToOfflineQueue(payload);

          onArrive({
            jobId,
            stopId,
            stopType,
            lat,
            lng,
            offline: true,
            badPinOverride: false,
          });
        } else if (inside) {
          setState('inside');
        } else {
          setState('outside');
        }
      },
      () => {
        if (!arrivedRef.current) {
          setState('no_gps');
        }
      }
    );

    watchIdRef.current = id;

    const gpsTimeout = setTimeout(() => {
      if (state === 'loading') {
        setState('no_gps');
      }
    }, 12000);

    return () => {
      stopWatching(watchIdRef.current);
      clearTimeout(gpsTimeout);
    };
  }, [target?.lat, target?.lng, jobId, stopId]);

  const handleArrive = () => {
    if (!driverPos) return;
    arrivedRef.current = true;
    stopWatching(watchIdRef.current);

    onArrive({
      jobId,
      stopId,
      stopType,
      lat: driverPos.lat,
      lng: driverPos.lng,
      offline: !navigator.onLine,
      badPinOverride: false,
    });
  };

  const handleBadPinOverride = (photoFile: File) => {
    if (!driverPos) return;
    arrivedRef.current = true;
    stopWatching(watchIdRef.current);
    setShowBadPinModal(false);

    onArrive({
      jobId,
      stopId,
      stopType,
      lat: driverPos.lat,
      lng: driverPos.lng,
      offline: !navigator.onLine,
      badPinOverride: true,
      badPinPhotoFile: photoFile,
    });
  };

  const handleDisabledTap = () => {
    if (state === 'outside' && driverPos) {
      setShowBadPinModal(true);
    }
  };

  if (state === 'no_target') {
    return (
      <button
        onClick={() => {
          if (driverPos) {
            arrivedRef.current = true;
            onArrive({
              jobId,
              stopId,
              stopType,
              lat: driverPos.lat,
              lng: driverPos.lng,
              offline: !navigator.onLine,
              badPinOverride: false,
            });
          } else {
            onArrive({
              jobId,
              stopId,
              stopType,
              lat: 0,
              lng: 0,
              offline: !navigator.onLine,
              badPinOverride: false,
            });
          }
        }}
        className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-600/20"
      >
        <MapPin className="w-5 h-5" />
        <span>Mark as Arrived</span>
      </button>
    );
  }

  if (state === 'arrived_offline') {
    return (
      <div className="space-y-2">
        <div className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/20">
          <WifiOff className="w-5 h-5" />
          <span>Arrived (Offline)</span>
        </div>
        <p className="text-xs text-amber-700 text-center font-medium">
          Arrival recorded locally. Will sync when connection restores.
        </p>
      </div>
    );
  }

  if (state === 'loading') {
    return (
      <button
        disabled
        className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 bg-gray-100 text-gray-400 border-2 border-gray-200 cursor-not-allowed"
      >
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Acquiring GPS...</span>
      </button>
    );
  }

  if (state === 'no_gps') {
    return (
      <button
        onClick={() => {
          onArrive({
            jobId,
            stopId,
            stopType,
            lat: 0,
            lng: 0,
            offline: !navigator.onLine,
            badPinOverride: false,
          });
        }}
        className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-600/20"
      >
        <MapPin className="w-5 h-5" />
        <span>Mark as Arrived</span>
      </button>
    );
  }

  if (state === 'inside') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-green-700">
            Within pickup zone ({distance}m)
          </span>
        </div>
        <button
          onClick={handleArrive}
          className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 active:scale-[0.98] bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-600/20"
        >
          <MapPin className="w-5 h-5" />
          <span>Mark as Arrived</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
          <Navigation className="w-3.5 h-3.5 text-red-500" />
          <span className="text-xs font-semibold text-red-700">
            {distance}m away from pickup pin
          </span>
        </div>
        <button
          onClick={handleDisabledTap}
          className="w-full py-4 rounded-xl font-bold text-base flex items-center justify-center gap-3 bg-gray-100 text-gray-400 border-2 border-dashed border-gray-300 cursor-pointer hover:bg-gray-50 hover:border-gray-400 transition-all"
        >
          <MapPinOff className="w-5 h-5" />
          <span>Mark as Arrived</span>
        </button>
        <p className="text-[11px] text-gray-400 text-center">
          Get within 100m of the pin, or tap to report a bad pin
        </p>
      </div>

      {showBadPinModal && distance != null && (
        <BadPinOverrideModal
          distanceMeters={distance}
          onConfirm={handleBadPinOverride}
          onCancel={() => setShowBadPinModal(false)}
        />
      )}
    </>
  );
}
