import { useEffect, useRef, useState, useCallback } from 'react';
import { Navigation, Loader2, AlertCircle, Package, WifiOff, Truck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useGoogleMaps } from '../hooks/useGoogleMaps';

interface DeliveryStop {
  id: string;
  stop_index: number;
  stop_type: 'PICKUP' | 'DROPOFF';
  location_text: string;
  location_lat: number | null;
  location_lng: number | null;
  status: 'NOT_STARTED' | 'ENROUTE' | 'ARRIVED' | 'COMPLETED';
}

interface DriverLocation {
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
  updated_at: string;
}

interface LiveTrackingMapProps {
  jobId: string;
  deliveryStops: DeliveryStop[];
  currentSelectedStopId?: string | null;
  routeType?: 'FIXED' | 'FLEXIBLE' | null;
}

const DEAD_ZONE_THRESHOLD_MS = 60_000;
const INTERPOLATION_DURATION_MS = 1500;
const STALENESS_CHECK_INTERVAL_MS = 5_000;

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpAngle(a: number, b: number, t: number): number {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return a + diff * t;
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function formatTimeSince(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export function LiveTrackingMap({ jobId, deliveryStops, currentSelectedStopId, routeType }: LiveTrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const stopMarkersRef = useRef<google.maps.Marker[]>([]);
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const prevLocationRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const hasFittedBoundsRef = useRef(false);

  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [lastUpdatedText, setLastUpdatedText] = useState('');
  const [isDeadZone, setIsDeadZone] = useState(false);
  const [deadZoneMinutes, setDeadZoneMinutes] = useState(0);
  const { isLoaded, loadError } = useGoogleMaps();

  const pickupStops = deliveryStops.filter(s => s.stop_type === 'PICKUP');
  const dropoffStops = deliveryStops.filter(s => s.stop_type === 'DROPOFF');
  const completedDropoffs = dropoffStops.filter(s => s.status === 'COMPLETED').length;
  const totalDropoffs = dropoffStops.length;

  useEffect(() => {
    const checkStaleness = () => {
      if (!driverLocation) return;
      const elapsed = Date.now() - new Date(driverLocation.updated_at).getTime();
      const dead = elapsed >= DEAD_ZONE_THRESHOLD_MS;
      setIsDeadZone(dead);
      if (dead) {
        setDeadZoneMinutes(Math.floor(elapsed / 60_000));
      }
      setLastUpdatedText(formatTimeSince(driverLocation.updated_at));
    };

    checkStaleness();
    const interval = setInterval(checkStaleness, STALENESS_CHECK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [driverLocation]);

  useEffect(() => {
    const fetchInitial = async () => {
      const { data } = await supabase
        .from('job_driver_location_current')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();
      if (data) setDriverLocation(data);
    };
    fetchInitial();

    const channel = supabase
      .channel(`live_track_${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'job_driver_location_current',
        filter: `job_id=eq.${jobId}`
      }, (payload) => {
        if (payload.new && 'lat' in payload.new) {
          setDriverLocation(payload.new as DriverLocation);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [jobId]);

  useEffect(() => {
    if (!isLoaded || !mapRef.current || googleMapRef.current) return;

    const defaultCenter = driverLocation
      ? { lat: driverLocation.lat, lng: driverLocation.lng }
      : deliveryStops[0]?.location_lat && deliveryStops[0]?.location_lng
        ? { lat: deliveryStops[0].location_lat, lng: deliveryStops[0].location_lng }
        : { lat: 10.6918, lng: -61.2225 };

    const map = new google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 13,
      mapTypeControl: false,
      fullscreenControl: true,
      streetViewControl: false,
      zoomControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
      ],
    });

    googleMapRef.current = map;

    directionsRendererRef.current = new google.maps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: '#3B82F6',
        strokeWeight: 5,
        strokeOpacity: 0.8,
      },
    });
  }, [isLoaded]);

  useEffect(() => {
    if (!googleMapRef.current || !isLoaded) return;

    stopMarkersRef.current.forEach(m => m.setMap(null));
    stopMarkersRef.current = [];

    const bounds = new google.maps.LatLngBounds();
    let hasValid = false;

    deliveryStops.forEach((stop) => {
      if (!stop.location_lat || !stop.location_lng) return;

      const position = { lat: stop.location_lat, lng: stop.location_lng };
      const isCompleted = stop.status === 'COMPLETED';
      const isNextDest = currentSelectedStopId === stop.id ||
        (!currentSelectedStopId && routeType === 'FIXED' && stop.status !== 'COMPLETED');

      const label = stop.stop_type === 'PICKUP'
        ? `P${pickupStops.findIndex(p => p.id === stop.id) + 1}`
        : `${dropoffStops.findIndex(d => d.id === stop.id) + 1}`;

      const fillColor = isCompleted ? '#10B981'
        : isNextDest ? '#F59E0B'
          : stop.stop_type === 'PICKUP' ? '#3B82F6' : '#EF4444';

      const marker = new google.maps.Marker({
        position,
        map: googleMapRef.current,
        label: { text: label, color: 'white', fontWeight: 'bold', fontSize: '13px' },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 18,
          fillColor,
          fillOpacity: isCompleted ? 0.5 : 1,
          strokeColor: 'white',
          strokeWeight: 2.5,
        },
        title: `${stop.stop_type === 'PICKUP' ? 'Pickup' : 'Stop'} ${label}: ${stop.location_text}`,
      });

      const infoContent = `
        <div style="padding: 10px; min-width: 200px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 700; margin-bottom: 4px; font-size: 14px;">
            ${stop.stop_type === 'PICKUP' ? 'Pickup' : 'Dropoff'} ${label}
          </div>
          <div style="font-size: 12px; color: #666; margin-bottom: 6px;">
            ${stop.location_text}
          </div>
          <div style="font-size: 11px; padding: 3px 10px; border-radius: 12px; display: inline-block; background: ${
  isCompleted ? '#D1FAE5' : isNextDest ? '#FEF3C7' : '#F3F4F6'
}; color: ${
  isCompleted ? '#065F46' : isNextDest ? '#92400E' : '#374151'
}; font-weight: 600;">
            ${isCompleted ? 'Completed' : isNextDest ? 'Next Destination' : stop.status.replace('_', ' ')}
          </div>
        </div>`;

      const infoWindow = new google.maps.InfoWindow({ content: infoContent });
      marker.addListener('click', () => infoWindow.open(googleMapRef.current!, marker));

      stopMarkersRef.current.push(marker);
      bounds.extend(position);
      hasValid = true;
    });

    if (driverLocation) {
      bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lng });
      hasValid = true;
    }

    if (hasValid && !hasFittedBoundsRef.current) {
      googleMapRef.current.fitBounds(bounds, 60);
      google.maps.event.addListenerOnce(googleMapRef.current, 'bounds_changed', () => {
        const zoom = googleMapRef.current!.getZoom();
        if (zoom && zoom > 16) googleMapRef.current!.setZoom(16);
      });
      hasFittedBoundsRef.current = true;
    }
  }, [deliveryStops, isLoaded, currentSelectedStopId, routeType]);

  const animateMarkerTo = useCallback((
    marker: google.maps.Marker,
    fromLat: number, fromLng: number, fromHeading: number,
    toLat: number, toLng: number, toHeading: number,
    dead: boolean
  ) => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const start = performance.now();

    const step = (now: number) => {
      const elapsed = now - start;
      const rawT = Math.min(elapsed / INTERPOLATION_DURATION_MS, 1);
      const t = easeInOut(rawT);

      const lat = lerp(fromLat, toLat, t);
      const lng = lerp(fromLng, toLng, t);
      const heading = lerpAngle(fromHeading, toHeading, t);

      marker.setPosition({ lat, lng });
      marker.setIcon(createTruckIcon(heading, dead));

      if (rawT < 1) {
        animationFrameRef.current = requestAnimationFrame(step);
      } else {
        animationFrameRef.current = null;
        prevLocationRef.current = { lat: toLat, lng: toLng, heading: toHeading };
      }
    };

    animationFrameRef.current = requestAnimationFrame(step);
  }, []);

  const createTruckIcon = (heading: number, dead: boolean): google.maps.Symbol => ({
    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
    scale: 7,
    fillColor: dead ? '#9CA3AF' : '#1D4ED8',
    fillOpacity: 1,
    strokeColor: dead ? '#6B7280' : '#1E3A8A',
    strokeWeight: 2,
    rotation: heading || 0,
    anchor: new google.maps.Point(0, 2.5),
  });

  useEffect(() => {
    if (!googleMapRef.current || !driverLocation || !isLoaded) {
      if (driverMarkerRef.current) {
        driverMarkerRef.current.setMap(null);
        driverMarkerRef.current = null;
      }
      prevLocationRef.current = null;
      return;
    }

    const newHeading = driverLocation.heading || 0;

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: { lat: driverLocation.lat, lng: driverLocation.lng },
        map: googleMapRef.current,
        icon: createTruckIcon(newHeading, isDeadZone),
        title: 'Driver Location',
        zIndex: 1000,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `<div style="padding:8px;font-family:system-ui,sans-serif;">
          <div style="font-weight:700;margin-bottom:4px;">Driver Location</div>
          <div style="font-size:12px;color:#666;">
            ${driverLocation.speed ? `Speed: ${Math.round(driverLocation.speed * 3.6)} km/h` : 'Stationary'}
          </div>
        </div>`,
      });
      driverMarkerRef.current.addListener('click', () => {
        infoWindow.open(googleMapRef.current!, driverMarkerRef.current!);
      });

      prevLocationRef.current = { lat: driverLocation.lat, lng: driverLocation.lng, heading: newHeading };
    } else {
      const prev = prevLocationRef.current || {
        lat: driverLocation.lat,
        lng: driverLocation.lng,
        heading: newHeading,
      };

      animateMarkerTo(
        driverMarkerRef.current,
        prev.lat, prev.lng, prev.heading,
        driverLocation.lat, driverLocation.lng, newHeading,
        isDeadZone
      );
    }
  }, [driverLocation, isLoaded, isDeadZone, animateMarkerTo]);

  useEffect(() => {
    if (driverMarkerRef.current && isLoaded) {
      const heading = driverLocation?.heading || prevLocationRef.current?.heading || 0;
      driverMarkerRef.current.setIcon(createTruckIcon(heading, isDeadZone));
    }
  }, [isDeadZone, isLoaded]);

  useEffect(() => {
    if (!googleMapRef.current || !driverLocation || !directionsRendererRef.current || !isLoaded) return;

    const nextStop = deliveryStops.find(s => {
      if (currentSelectedStopId) return s.id === currentSelectedStopId;
      if (routeType === 'FIXED') return s.status !== 'COMPLETED';
      return false;
    });

    if (!nextStop || !nextStop.location_lat || !nextStop.location_lng) {
      directionsRendererRef.current.setMap(null);
      return;
    }

    const directionsService = new google.maps.DirectionsService();
    directionsService.route(
      {
        origin: { lat: driverLocation.lat, lng: driverLocation.lng },
        destination: { lat: nextStop.location_lat, lng: nextStop.location_lng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result) {
          directionsRendererRef.current?.setMap(googleMapRef.current);
          directionsRendererRef.current?.setDirections(result);
        }
      }
    );
  }, [driverLocation, deliveryStops, currentSelectedStopId, routeType, isLoaded]);

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4">
        <div className="flex items-center gap-2 text-red-800">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">Map failed to load</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-12 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        <p className="text-sm text-gray-500">Loading map...</p>
      </div>
    );
  }

  const getNextDestinationText = () => {
    if (currentSelectedStopId) {
      const stop = deliveryStops.find(s => s.id === currentSelectedStopId);
      if (stop) {
        const label = stop.stop_type === 'PICKUP'
          ? `P${pickupStops.findIndex(p => p.id === stop.id) + 1}`
          : `Stop ${dropoffStops.findIndex(d => d.id === stop.id) + 1}`;
        return `${label}: ${stop.location_text}`;
      }
    }
    if (routeType === 'FIXED') {
      const nextStop = deliveryStops.find(s => s.status !== 'COMPLETED');
      if (nextStop) {
        const label = nextStop.stop_type === 'PICKUP'
          ? `P${pickupStops.findIndex(p => p.id === nextStop.id) + 1}`
          : `Stop ${dropoffStops.findIndex(d => d.id === nextStop.id) + 1}`;
        return `${label}: ${nextStop.location_text}`;
      }
    }
    if (routeType === 'FLEXIBLE') return 'Driver selecting next stop';
    return 'No active destination';
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="w-4 h-4 text-blue-700" />
            </div>
            Live Tracking
          </h3>
          {driverLocation && (
            <div className={`text-xs px-3 py-1.5 rounded-full font-semibold flex items-center gap-1.5 ${
              isDeadZone
                ? 'bg-gray-100 text-gray-600'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isDeadZone ? 'bg-gray-400' : 'bg-green-500 animate-pulse'
              }`} />
              {isDeadZone ? `Last seen ${lastUpdatedText}` : `Updated ${lastUpdatedText}`}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-2">
            <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
            <div>
              <p className="text-[10px] text-blue-600 font-medium uppercase tracking-wide">Delivered</p>
              <p className="text-sm font-bold text-blue-900">{completedDropoffs} / {totalDropoffs}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-3 py-2">
            <Navigation className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-amber-600 font-medium uppercase tracking-wide">Next Stop</p>
              <p className="text-xs font-semibold text-amber-900 truncate">{getNextDestinationText()}</p>
            </div>
          </div>
        </div>

        {isDeadZone && (
          <div className="flex items-start gap-2.5 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <WifiOff className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-semibold text-gray-700">
                Driver is in a poor signal area. Tracking paused.
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Last seen {deadZoneMinutes} min{deadZoneMinutes !== 1 ? 's' : ''} ago.
                Location will resume when signal returns.
              </p>
            </div>
          </div>
        )}
      </div>

      <div ref={mapRef} className="w-full h-[400px] md:h-[480px] bg-gray-100" />
    </div>
  );
}
