import { useEffect, useRef, useState, useCallback } from 'react';
import { Loader2, AlertCircle, Navigation, ChevronUp, ChevronDown } from 'lucide-react';
import { useGoogleMaps } from '../hooks/useGoogleMaps';
import { watchPosition, stopWatching } from '../lib/geofence';

interface DriverNavigationMapProps {
  destinationLat: number;
  destinationLng: number;
  destinationLabel: string;
  isReturning?: boolean;
}

interface DriverPos {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
}

const ROUTE_REFETCH_DISTANCE_M = 300;

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function DriverNavigationMap({
  destinationLat,
  destinationLng,
  destinationLabel,
  isReturning = false,
}: DriverNavigationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const lastRouteFetchPos = useRef<{ lat: number; lng: number } | null>(null);
  const hasFittedRef = useRef(false);

  const [driverPos, setDriverPos] = useState<DriverPos | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [etaText, setEtaText] = useState<string | null>(null);
  const [distanceText, setDistanceText] = useState<string | null>(null);

  const { isLoaded, loadError } = useGoogleMaps();

  useEffect(() => {
    const watchId = watchPosition(
      (pos) => {
        setDriverPos({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
        });
      },
      (err) => console.warn('Nav map GPS error:', err.message)
    );
    return () => stopWatching(watchId);
  }, []);

  useEffect(() => {
    if (!isLoaded || !mapContainerRef.current || mapRef.current) return;

    const center = driverPos
      ? { lat: driverPos.lat, lng: driverPos.lng }
      : { lat: destinationLat, lng: destinationLng };

    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 14,
      mapTypeControl: false,
      fullscreenControl: false,
      streetViewControl: false,
      zoomControl: false,
      gestureHandling: 'greedy',
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
      ],
    });

    destMarkerRef.current = new google.maps.Marker({
      position: { lat: destinationLat, lng: destinationLng },
      map: mapRef.current,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 14,
        fillColor: isReturning ? '#DC2626' : '#EF4444',
        fillOpacity: 1,
        strokeColor: 'white',
        strokeWeight: 3,
      },
      label: {
        text: isReturning ? 'R' : 'D',
        color: 'white',
        fontWeight: 'bold',
        fontSize: '11px',
      },
      title: destinationLabel,
      zIndex: 500,
    });

    polylineRef.current = new google.maps.Polyline({
      map: mapRef.current,
      strokeColor: isReturning ? '#DC2626' : '#2563EB',
      strokeWeight: 6,
      strokeOpacity: 0.85,
    });
  }, [isLoaded]);

  const fetchRoute = useCallback((origin: { lat: number; lng: number }) => {
    if (!mapRef.current) return;

    const service = new google.maps.DirectionsService();
    service.route(
      {
        origin,
        destination: { lat: destinationLat, lng: destinationLng },
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK' && result && polylineRef.current) {
          const path = result.routes[0]?.overview_path;
          if (path) {
            polylineRef.current.setPath(path);
          }

          const leg = result.routes[0]?.legs?.[0];
          if (leg) {
            setEtaText(leg.duration?.text || null);
            setDistanceText(leg.distance?.text || null);
          }

          lastRouteFetchPos.current = origin;
        }
      }
    );
  }, [destinationLat, destinationLng]);

  useEffect(() => {
    if (!driverPos || !mapRef.current || !isLoaded) return;

    const pos = { lat: driverPos.lat, lng: driverPos.lng };

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 7,
          fillColor: '#1D4ED8',
          fillOpacity: 1,
          strokeColor: '#1E3A8A',
          strokeWeight: 2,
          rotation: driverPos.heading || 0,
          anchor: new google.maps.Point(0, 2.5),
        },
        zIndex: 1000,
        title: 'You',
      });
    } else {
      driverMarkerRef.current.setPosition(pos);
      driverMarkerRef.current.setIcon({
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 7,
        fillColor: '#1D4ED8',
        fillOpacity: 1,
        strokeColor: '#1E3A8A',
        strokeWeight: 2,
        rotation: driverPos.heading || 0,
        anchor: new google.maps.Point(0, 2.5),
      });
    }

    if (!hasFittedRef.current) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend(pos);
      bounds.extend({ lat: destinationLat, lng: destinationLng });
      mapRef.current.fitBounds(bounds, 70);
      google.maps.event.addListenerOnce(mapRef.current, 'bounds_changed', () => {
        const z = mapRef.current!.getZoom();
        if (z && z > 17) mapRef.current!.setZoom(17);
      });
      hasFittedRef.current = true;
    }

    const needsRoute = !lastRouteFetchPos.current ||
      haversineM(lastRouteFetchPos.current.lat, lastRouteFetchPos.current.lng, pos.lat, pos.lng) >= ROUTE_REFETCH_DISTANCE_M;

    if (needsRoute) {
      fetchRoute(pos);
    }
  }, [driverPos, isLoaded, fetchRoute, destinationLat, destinationLng]);

  const wazeUrl = `waze://?ll=${destinationLat},${destinationLng}&navigate=yes`;
  const gmapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destinationLat},${destinationLng}`;

  if (loadError) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-3">
        <div className="flex items-center gap-2 text-red-800 text-sm">
          <AlertCircle className="w-4 h-4" />
          <p className="font-medium">Map unavailable</p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 flex flex-col items-center gap-2">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
        <p className="text-xs text-gray-500">Loading navigation...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`w-full px-4 py-3 flex items-center justify-between ${
          isReturning
            ? 'bg-gradient-to-r from-red-50 to-red-50/50'
            : 'bg-gradient-to-r from-blue-50 to-blue-50/50'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            isReturning ? 'bg-red-100' : 'bg-blue-100'
          }`}>
            <Navigation className={`w-4 h-4 ${isReturning ? 'text-red-700' : 'text-blue-700'}`} />
          </div>
          <div className="text-left">
            <p className={`text-sm font-bold ${isReturning ? 'text-red-900' : 'text-gray-900'}`}>
              {isReturning ? 'Return Navigation' : 'Route Overview'}
            </p>
            {etaText && distanceText && (
              <p className="text-xs text-gray-500">{distanceText} &middot; {etaText}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!driverPos && (
            <span className="text-[10px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
              Acquiring GPS...
            </span>
          )}
          {collapsed ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {!collapsed && (
        <>
          <div className="relative">
            <div ref={mapContainerRef} className="w-full h-[280px] bg-gray-100" />

            <div className="absolute bottom-3 left-3 right-3 flex gap-2">
              <a
                href={wazeUrl}
                className="flex-1 py-3 bg-[#33CCFF] hover:bg-[#29b8e6] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors active:scale-[0.97]"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M20.54 6.63c.69 2.24.46 4.27-.07 5.42-.2.44-.41.79-.68 1.1a6.84 6.84 0 01-1.57 1.37c-.25.15-.5.28-.75.4-.04.52-.16 1.05-.36 1.55a5.47 5.47 0 01-2.75 2.9c-.62.3-1.28.48-1.96.55-.34.03-.61.03-.86.01a10.83 10.83 0 01-4.13-.98c-.38-.18-.73-.38-1.06-.6l-.07-.05a6.5 6.5 0 01-2.02-2.16c-.17-.3-.31-.6-.42-.93a5.13 5.13 0 01-.3-1.77c0-.2.01-.4.04-.6-1.16-.12-2.01-.58-2.56-1.38-.3-.44-.48-.94-.53-1.48a2.97 2.97 0 01.32-1.67A3.04 3.04 0 012.9 7.1c.53-.25 1.12-.37 1.74-.36a4.42 4.42 0 011.87.49c.23-.68.56-1.3.97-1.86A7.07 7.07 0 0111.73 2.6c.8-.22 1.63-.33 2.47-.3.9.03 1.78.2 2.6.51A7.77 7.77 0 0120.54 6.63zM9.34 10.39a1.2 1.2 0 100 2.39 1.2 1.2 0 000-2.39zm5.32 0a1.2 1.2 0 100 2.39 1.2 1.2 0 000-2.39zm-4.66 4.16c-.13.24-.04.55.2.68.46.26 1.25.51 2.28.51s1.82-.25 2.28-.51c.25-.13.33-.44.2-.68-.14-.24-.44-.33-.69-.2-.28.16-.9.38-1.79.38-.9 0-1.51-.22-1.8-.38a.5.5 0 00-.68.2z" />
                </svg>
                Waze
              </a>
              <a
                href={gmapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 bg-[#4285F4] hover:bg-[#3574d4] text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg transition-colors active:scale-[0.97]"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" />
                </svg>
                Google Maps
              </a>
            </div>

            {etaText && distanceText && (
              <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg px-3 py-2 shadow-md border border-gray-200/50">
                <p className="text-xs font-bold text-gray-900">{distanceText}</p>
                <p className="text-[10px] text-gray-500">{etaText} estimated</p>
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-gray-100 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isReturning ? 'bg-red-500' : 'bg-red-500'}`} />
            <p className="text-xs text-gray-600 truncate">
              <span className="font-semibold">{isReturning ? 'Return to:' : 'Heading to:'}</span>{' '}
              {destinationLabel}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
