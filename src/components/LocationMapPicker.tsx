import { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation } from 'lucide-react';

interface LocationMapPickerProps {
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  onPickupChange: (address: string, lat: number, lng: number) => void;
  onDropoffChange: (address: string, lat: number, lng: number) => void;
  mapsLoaded: boolean;
}

export function LocationMapPicker({
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
  onPickupChange,
  onDropoffChange,
  mapsLoaded
}: LocationMapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [pickupMarker, setPickupMarker] = useState<google.maps.Marker | null>(null);
  const [dropoffMarker, setDropoffMarker] = useState<google.maps.Marker | null>(null);
  const [activePin, setActivePin] = useState<'pickup' | 'dropoff'>('pickup');
  const activePinRef = useRef<'pickup' | 'dropoff'>('pickup');
  const [geocoder, setGeocoder] = useState<google.maps.Geocoder | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    activePinRef.current = activePin;
  }, [activePin]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => {
          setUserLocation(null);
        }
      );
    }
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !window.google || !mapRef.current) return;

    const center = userLocation || { lat: 10.6918, lng: -61.2225 };

    const mapInstance = new google.maps.Map(mapRef.current, {
      center,
      zoom: userLocation ? 14 : 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
    });

    const geocoderInstance = new google.maps.Geocoder();
    setGeocoder(geocoderInstance);

    mapInstance.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (e.latLng) {
        const lat = e.latLng.lat();
        const lng = e.latLng.lng();

        geocoderInstance.geocode(
          { location: { lat, lng } },
          (results, status) => {
            if (status === 'OK' && results && results[0]) {
              const address = results[0].formatted_address;

              if (activePinRef.current === 'pickup') {
                onPickupChange(address, lat, lng);
              } else {
                onDropoffChange(address, lat, lng);
              }
            } else {
              const fallbackAddress = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
              if (activePinRef.current === 'pickup') {
                onPickupChange(fallbackAddress, lat, lng);
              } else {
                onDropoffChange(fallbackAddress, lat, lng);
              }
            }
          }
        );
      }
    });

    setMap(mapInstance);

    return () => {
      if (mapInstance) {
        google.maps.event.clearInstanceListeners(mapInstance);
      }
    };
  }, [mapsLoaded, userLocation]);

  useEffect(() => {
    if (!map || !mapsLoaded) return;

    if (pickupMarker) {
      pickupMarker.setMap(null);
    }

    if (pickupLat !== 0 && pickupLng !== 0) {
      const marker = new google.maps.Marker({
        position: { lat: pickupLat, lng: pickupLng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#3b82f6',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: 'Pickup Location',
        draggable: true,
      });

      marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
        if (e.latLng && geocoder) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          geocoder.geocode(
            { location: { lat, lng } },
            (results, status) => {
              if (status === 'OK' && results && results[0]) {
                onPickupChange(results[0].formatted_address, lat, lng);
              } else {
                onPickupChange(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng);
              }
            }
          );
        }
      });

      setPickupMarker(marker);
    }
  }, [pickupLat, pickupLng, map, mapsLoaded]);

  useEffect(() => {
    if (!map || !mapsLoaded) return;

    if (dropoffMarker) {
      dropoffMarker.setMap(null);
    }

    if (dropoffLat !== 0 && dropoffLng !== 0) {
      const marker = new google.maps.Marker({
        position: { lat: dropoffLat, lng: dropoffLng },
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 12,
          fillColor: '#10b981',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 3,
        },
        title: 'Dropoff Location',
        draggable: true,
      });

      marker.addListener('dragend', (e: google.maps.MapMouseEvent) => {
        if (e.latLng && geocoder) {
          const lat = e.latLng.lat();
          const lng = e.latLng.lng();

          geocoder.geocode(
            { location: { lat, lng } },
            (results, status) => {
              if (status === 'OK' && results && results[0]) {
                onDropoffChange(results[0].formatted_address, lat, lng);
              } else {
                onDropoffChange(`${lat.toFixed(6)}, ${lng.toFixed(6)}`, lat, lng);
              }
            }
          );
        }
      });

      setDropoffMarker(marker);
    }
  }, [dropoffLat, dropoffLng, map, mapsLoaded]);

  useEffect(() => {
    if (!map || !pickupLat || !dropoffLat || pickupLat === 0 || dropoffLat === 0) return;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: pickupLat, lng: pickupLng });
    bounds.extend({ lat: dropoffLat, lng: dropoffLng });
    map.fitBounds(bounds, 50);
  }, [pickupLat, pickupLng, dropoffLat, dropoffLng, map]);

  const handleCenterOnUser = () => {
    if (map && userLocation) {
      map.panTo(userLocation);
      map.setZoom(14);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          if (map) {
            map.panTo(location);
            map.setZoom(14);
          }
        }
      );
    }
  };

  if (!mapsLoaded) {
    return (
      <div className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
            <MapPin className="w-7 h-7 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Map unavailable</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Google Maps API key is not configured. You can still type addresses in the fields above to set your locations.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setActivePin('pickup')}
          className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-all flex items-center justify-center gap-2 ${
            activePin === 'pickup'
              ? 'border-blue-500 bg-blue-50 text-blue-700'
              : 'border-gray-300 text-gray-700 hover:border-gray-400'
          }`}
        >
          <div className={`w-4 h-4 rounded-full ${activePin === 'pickup' ? 'bg-blue-500' : 'bg-gray-400'}`} />
          Pickup Pin
        </button>

        <button
          type="button"
          onClick={() => setActivePin('dropoff')}
          className={`flex-1 py-3 px-4 rounded-lg border-2 font-semibold transition-all flex items-center justify-center gap-2 ${
            activePin === 'dropoff'
              ? 'border-green-500 bg-green-50 text-green-700'
              : 'border-gray-300 text-gray-700 hover:border-gray-400'
          }`}
        >
          <div className={`w-4 h-4 rounded-full ${activePin === 'dropoff' ? 'bg-green-500' : 'bg-gray-400'}`} />
          Dropoff Pin
        </button>
      </div>

      <div className="relative">
        <div ref={mapRef} className="w-full h-96 rounded-lg border-2 border-gray-300" />

        <button
          type="button"
          onClick={handleCenterOnUser}
          className="absolute top-3 right-3 p-3 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-all"
          title="Center on my location"
        >
          <Navigation className="w-5 h-5 text-gray-700" />
        </button>

        <div className="absolute bottom-3 left-3 bg-white rounded-lg shadow-lg border border-gray-200 px-4 py-2">
          <p className="text-sm font-medium text-gray-900">
            {activePin === 'pickup' ? (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                Click map to drop pickup pin
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                Click map to drop dropoff pin
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
        <div className="flex items-start gap-3">
          <MapPin className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-gray-900 mb-1">How to use:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Select whether you're dropping a pickup or dropoff pin</li>
              <li>Click anywhere on the map to place the pin</li>
              <li>Drag pins to adjust their position</li>
              <li>Both locations must be set before continuing</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
