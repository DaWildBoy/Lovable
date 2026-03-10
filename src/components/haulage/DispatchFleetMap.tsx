import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { useGoogleMaps } from '../../hooks/useGoogleMaps';
import { Map, Navigation, Maximize2, Minimize2, Truck } from 'lucide-react';

interface DriverOnMap {
  jobId: string;
  driverName: string;
  lat: number;
  lng: number;
  status: string;
  pickupText: string;
  dropoffText: string;
}

export function DispatchFleetMap() {
  const { profile } = useAuth();
  const { isLoaded: mapsLoaded } = useGoogleMaps();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [drivers, setDrivers] = useState<DriverOnMap[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchDriverLocations();
    const interval = setInterval(fetchDriverLocations, 15000);
    return () => clearInterval(interval);
  }, [profile?.id]);

  useEffect(() => {
    if (!mapsLoaded || !mapRef.current) return;
    initMap();
  }, [mapsLoaded, expanded]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    updateMarkers();
  }, [drivers]);

  const fetchDriverLocations = async () => {
    try {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, assigned_driver_name, courier_location_lat, courier_location_lng, status, pickup_location_text, dropoff_location_text')
        .eq('assigned_company_id', profile!.id)
        .in('status', ['on_way_to_pickup', 'cargo_collected', 'in_transit'])
        .not('courier_location_lat', 'is', null);

      if (error) throw error;

      const onMap: DriverOnMap[] = (jobs || [])
        .filter(j => j.courier_location_lat && j.courier_location_lng)
        .map(j => ({
          jobId: j.id,
          driverName: j.assigned_driver_name || 'Driver',
          lat: j.courier_location_lat!,
          lng: j.courier_location_lng!,
          status: j.status,
          pickupText: j.pickup_location_text || '',
          dropoffText: j.dropoff_location_text || ''
        }));

      setDrivers(onMap);
    } catch (err) {
      console.error('Error fetching driver locations:', err);
    } finally {
      setLoading(false);
    }
  };

  const initMap = () => {
    if (!mapRef.current || !window.google) return;

    const defaultCenter = { lat: 10.5, lng: -61.3 };

    const map = new google.maps.Map(mapRef.current, {
      center: drivers.length > 0 ? { lat: drivers[0].lat, lng: drivers[0].lng } : defaultCenter,
      zoom: 11,
      disableDefaultUI: true,
      zoomControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
        { featureType: 'water', stylers: [{ color: '#c9d6e5' }] },
        { featureType: 'landscape', stylers: [{ color: '#f0f3f7' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#dde3ea' }] },
        { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#c5cdd6' }] },
      ]
    });

    mapInstanceRef.current = map;
    updateMarkers();
  };

  const updateMarkers = () => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (!mapInstanceRef.current || !window.google) return;

    const bounds = new google.maps.LatLngBounds();

    drivers.forEach(driver => {
      const statusColor = driver.status === 'in_transit' ? '#16A34A' :
        driver.status === 'cargo_collected' ? '#0D9488' : '#D97706';

      const marker = new google.maps.Marker({
        position: { lat: driver.lat, lng: driver.lng },
        map: mapInstanceRef.current!,
        title: driver.driverName,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          fillColor: statusColor,
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 6,
          rotation: 0,
        }
      });

      const infoWindow = new google.maps.InfoWindow({
        content: `
          <div style="font-family:Inter,sans-serif;padding:4px 0;min-width:160px">
            <p style="font-weight:600;font-size:13px;margin:0 0 4px">${driver.driverName}</p>
            <p style="font-size:11px;color:#6B7280;margin:0">${driver.status.replace(/_/g, ' ').toUpperCase()}</p>
            <p style="font-size:11px;color:#9CA3AF;margin:4px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px">
              To: ${driver.dropoffText}
            </p>
          </div>
        `
      });

      marker.addListener('click', () => {
        infoWindow.open(mapInstanceRef.current!, marker);
      });

      markersRef.current.push(marker);
      bounds.extend({ lat: driver.lat, lng: driver.lng });
    });

    if (drivers.length > 1) {
      mapInstanceRef.current.fitBounds(bounds, 50);
    } else if (drivers.length === 1) {
      mapInstanceRef.current.setCenter({ lat: drivers[0].lat, lng: drivers[0].lng });
      mapInstanceRef.current.setZoom(13);
    }
  };

  const mapHeight = expanded ? 'h-80' : 'h-48';

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-4 pb-0">
        <div className="flex items-center gap-2">
          <Map className="w-5 h-5 text-moveme-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Fleet Location</h3>
        </div>
        <div className="flex items-center gap-2">
          {drivers.length > 0 && (
            <span className="flex items-center gap-1 text-xs bg-success-100 text-success-700 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse-soft" />
              {drivers.length} active
            </span>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {expanded ? (
              <Minimize2 className="w-4 h-4 text-gray-500" />
            ) : (
              <Maximize2 className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      <div className="p-4 pt-3">
        {!mapsLoaded ? (
          <div className={`${mapHeight} bg-gray-50 rounded-xl flex items-center justify-center transition-all border-2 border-dashed border-gray-200`}>
            <div className="text-center">
              <Navigation className="w-6 h-6 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500 font-medium">Fleet map unavailable</p>
              <p className="text-[10px] text-gray-400 mt-1">Google Maps API key not configured</p>
            </div>
          </div>
        ) : loading ? (
          <div className={`${mapHeight} bg-gray-100 rounded-xl flex items-center justify-center transition-all`}>
            <div className="text-center">
              <Navigation className="w-6 h-6 text-gray-300 mx-auto mb-2 animate-pulse" />
              <p className="text-xs text-gray-400">Loading map...</p>
            </div>
          </div>
        ) : drivers.length === 0 ? (
          <div className={`${mapHeight} bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl flex items-center justify-center border border-gray-200 border-dashed transition-all`}>
            <div className="text-center">
              <Truck className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400 font-medium">No active drivers on the road</p>
              <p className="text-xs text-gray-300 mt-1">Driver locations appear when jobs are in transit</p>
            </div>
          </div>
        ) : (
          <div ref={mapRef} className={`${mapHeight} rounded-xl transition-all`} />
        )}

        {drivers.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-success-500" />
              <span className="text-gray-500">In Transit</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-moveme-teal-500" />
              <span className="text-gray-500">Cargo Collected</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-warning-500" />
              <span className="text-gray-500">En Route to Pickup</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
