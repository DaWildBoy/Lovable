import { useEffect, useRef, useState } from 'react';
import { MapPin, GripVertical, Plus, Trash2, Navigation, AlertCircle, BookmarkPlus } from 'lucide-react';
import { GooglePlacesAutocomplete, type GooglePlacesAutocompleteRef } from './GooglePlacesAutocomplete';

export interface RouteLocation {
  id: string;
  address: string;
  lat: number;
  lng: number;
  label?: string;
}

export interface PickupGroup {
  id: string;
  pickup: RouteLocation;
  dropoffs: RouteLocation[];
}

interface RouteMapPlannerProps {
  pickups: RouteLocation[];
  dropoffs: RouteLocation[];
  hasMultiplePickups: boolean;
  onPickupsChange: (pickups: RouteLocation[]) => void;
  onDropoffsChange: (dropoffs: RouteLocation[]) => void;
  onMultiplePickupsToggle: (enabled: boolean) => void;
  onDistanceChange: (distanceKm: number, etaMinutes: number) => void;
  mapsLoaded: boolean;
  useMergedMode?: boolean;
  pickupGroups?: PickupGroup[];
  onPickupGroupsChange?: (groups: PickupGroup[]) => void;
  showMultiplePickupsToggle?: boolean;
}

export function RouteMapPlanner({
  pickups,
  dropoffs,
  hasMultiplePickups,
  onPickupsChange,
  onDropoffsChange,
  onMultiplePickupsToggle,
  onDistanceChange,
  mapsLoaded,
  useMergedMode = false,
  pickupGroups = [],
  onPickupGroupsChange,
  showMultiplePickupsToggle = false
}: RouteMapPlannerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markers, setMarkers] = useState<google.maps.Marker[]>([]);
  const [polyline, setPolyline] = useState<google.maps.Polyline | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedPickupIndex, setDraggedPickupIndex] = useState<number | null>(null);
  const [draggedDropoffInfo, setDraggedDropoffInfo] = useState<{ pickupIndex: number; dropoffIndex: number } | null>(null);
  const autocompleteRefs = useRef<Map<string, GooglePlacesAutocompleteRef>>(new Map());
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        () => setUserLocation(null)
      );
    }
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !window.google || !mapRef.current) return;

    const center = userLocation || { lat: 10.6918, lng: -61.2225 };

    const mapInstance = new google.maps.Map(mapRef.current, {
      center,
      zoom: userLocation ? 12 : 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
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

    markers.forEach(marker => marker.setMap(null));
    if (polyline) polyline.setMap(null);

    const newMarkers: google.maps.Marker[] = [];
    const bounds = new google.maps.LatLngBounds();
    let hasValidLocations = false;

    if (useMergedMode && pickupGroups.length > 0) {
      let dropoffCounter = 0;

      pickupGroups.forEach((group, pickupIndex) => {
        if (group.pickup.lat !== 0 && group.pickup.lng !== 0) {
          hasValidLocations = true;
          const marker = new google.maps.Marker({
            position: { lat: group.pickup.lat, lng: group.pickup.lng },
            map,
            label: {
              text: `P${pickupIndex + 1}`,
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold'
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            },
            title: `Pickup ${pickupIndex + 1}: ${group.pickup.address}`,
          });
          newMarkers.push(marker);
          bounds.extend({ lat: group.pickup.lat, lng: group.pickup.lng });
        }

        group.dropoffs.forEach((dropoff) => {
          if (dropoff.lat !== 0 && dropoff.lng !== 0) {
            hasValidLocations = true;
            dropoffCounter++;
            const marker = new google.maps.Marker({
              position: { lat: dropoff.lat, lng: dropoff.lng },
              map,
              label: {
                text: `${dropoffCounter}`,
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold'
              },
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 16,
                fillColor: '#10b981',
                fillOpacity: 1,
                strokeColor: '#ffffff',
                strokeWeight: 3,
              },
              title: `Stop ${dropoffCounter}: ${dropoff.address}`,
            });
            newMarkers.push(marker);
            bounds.extend({ lat: dropoff.lat, lng: dropoff.lng });
          }
        });
      });
    } else {
      pickups.forEach((pickup, index) => {
        if (pickup.lat !== 0 && pickup.lng !== 0) {
          hasValidLocations = true;
          const marker = new google.maps.Marker({
            position: { lat: pickup.lat, lng: pickup.lng },
            map,
            label: {
              text: hasMultiplePickups ? `P${index + 1}` : 'P',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold'
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: '#3b82f6',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            },
            title: `Pickup ${index + 1}: ${pickup.address}`,
          });
          newMarkers.push(marker);
          bounds.extend({ lat: pickup.lat, lng: pickup.lng });
        }
      });

      dropoffs.forEach((dropoff, index) => {
        if (dropoff.lat !== 0 && dropoff.lng !== 0) {
          hasValidLocations = true;
          const marker = new google.maps.Marker({
            position: { lat: dropoff.lat, lng: dropoff.lng },
            map,
            label: {
              text: `${index + 1}`,
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 'bold'
            },
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 16,
              fillColor: '#10b981',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 3,
            },
            title: `Stop ${index + 1}: ${dropoff.address}`,
          });
          newMarkers.push(marker);
          bounds.extend({ lat: dropoff.lat, lng: dropoff.lng });
        }
      });
    }

    if (hasValidLocations) {
      map.fitBounds(bounds, 50);
    }

    setMarkers(newMarkers);

    const allStops = useMergedMode && pickupGroups.length > 0
      ? pickupGroups.flatMap(group => [group.pickup, ...group.dropoffs])
      : [...pickups, ...dropoffs];

    const validStops = allStops.filter(loc => loc.lat !== 0 && loc.lng !== 0);

    if (validStops.length >= 2) {
      const path = validStops.map(loc => ({ lat: loc.lat, lng: loc.lng }));
      const newPolyline = new google.maps.Polyline({
        path,
        geodesic: true,
        strokeColor: '#6366f1',
        strokeOpacity: 0.8,
        strokeWeight: 4,
        map,
      });
      setPolyline(newPolyline);
    }
  }, [pickups, dropoffs, pickupGroups, hasMultiplePickups, useMergedMode, map, mapsLoaded]);

  useEffect(() => {
    calculateMultiStopDistance();
  }, [pickups, dropoffs, pickupGroups, useMergedMode, mapsLoaded]);

  const calculateMultiStopDistance = async () => {
    if (!mapsLoaded || !window.google) return;

    const allStops = useMergedMode && pickupGroups.length > 0
      ? pickupGroups.flatMap(group => [group.pickup, ...group.dropoffs])
      : [...pickups, ...dropoffs];

    const validStops = allStops.filter(loc => loc.lat !== 0 && loc.lng !== 0);

    if (validStops.length < 2) {
      onDistanceChange(0, 0);
      return;
    }

    let totalDistance = 0;
    let totalDuration = 0;

    try {
      const service = new google.maps.DistanceMatrixService();

      for (let i = 0; i < validStops.length - 1; i++) {
        const origin = validStops[i];
        const destination = validStops[i + 1];

        const result = await new Promise<google.maps.DistanceMatrixResponse>((resolve, reject) => {
          service.getDistanceMatrix(
            {
              origins: [{ lat: origin.lat, lng: origin.lng }],
              destinations: [{ lat: destination.lat, lng: destination.lng }],
              travelMode: google.maps.TravelMode.DRIVING,
            },
            (response, status) => {
              if (status === 'OK' && response) {
                resolve(response);
              } else {
                reject(new Error(status));
              }
            }
          );
        });

        if (result.rows[0]?.elements[0]?.distance) {
          totalDistance += result.rows[0].elements[0].distance.value;
        }
        if (result.rows[0]?.elements[0]?.duration) {
          totalDuration += result.rows[0].elements[0].duration.value;
        }
      }

      const distanceKm = Math.round((totalDistance / 1000) * 10) / 10;
      const etaMinutes = Math.ceil(totalDuration / 60);

      onDistanceChange(distanceKm, etaMinutes);
    } catch (error) {
      console.warn('Distance calculation failed, using fallback');
      let fallbackDistance = 0;
      for (let i = 0; i < validStops.length - 1; i++) {
        const straightLine = calculateHaversineDistance(
          validStops[i].lat,
          validStops[i].lng,
          validStops[i + 1].lat,
          validStops[i + 1].lng
        );
        fallbackDistance += straightLine * 1.3;
      }
      onDistanceChange(Math.round(fallbackDistance * 10) / 10, Math.ceil(fallbackDistance * 3));
    }
  };

  const calculateHaversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const addPickup = () => {
    if (useMergedMode && onPickupGroupsChange) {
      const newGroup: PickupGroup = {
        id: `pickup-group-${Date.now()}`,
        pickup: {
          id: `pickup-${Date.now()}`,
          address: '',
          lat: 0,
          lng: 0,
        },
        dropoffs: [{
          id: `dropoff-${Date.now()}-1`,
          address: '',
          lat: 0,
          lng: 0,
        }]
      };
      onPickupGroupsChange([...pickupGroups, newGroup]);
    } else {
      const newPickup: RouteLocation = {
        id: `pickup-${Date.now()}`,
        address: '',
        lat: 0,
        lng: 0,
      };
      onPickupsChange([...pickups, newPickup]);
    }
  };

  const addDropoff = (pickupIndex?: number) => {
    if (useMergedMode && onPickupGroupsChange && pickupIndex !== undefined) {
      const newGroups = [...pickupGroups];
      const newDropoff: RouteLocation = {
        id: `dropoff-${Date.now()}`,
        address: '',
        lat: 0,
        lng: 0,
      };
      newGroups[pickupIndex].dropoffs.push(newDropoff);
      onPickupGroupsChange(newGroups);
    } else {
      const newDropoff: RouteLocation = {
        id: `dropoff-${Date.now()}`,
        address: '',
        lat: 0,
        lng: 0,
      };
      onDropoffsChange([...dropoffs, newDropoff]);
    }
  };

  const removePickup = (index: number) => {
    if (useMergedMode && onPickupGroupsChange) {
      if (pickupGroups.length === 1) return;
      onPickupGroupsChange(pickupGroups.filter((_, i) => i !== index));
    } else {
      if (pickups.length === 1) return;
      onPickupsChange(pickups.filter((_, i) => i !== index));
    }
  };

  const removeDropoff = (pickupIndex: number, dropoffIndex: number) => {
    if (useMergedMode && onPickupGroupsChange) {
      const newGroups = [...pickupGroups];
      if (newGroups[pickupIndex].dropoffs.length === 1) return;
      newGroups[pickupIndex].dropoffs = newGroups[pickupIndex].dropoffs.filter((_, i) => i !== dropoffIndex);
      onPickupGroupsChange(newGroups);
    } else {
      if (dropoffs.length === 1) return;
      onDropoffsChange(dropoffs.filter((_, i) => i !== dropoffIndex));
    }
  };

  const updatePickup = (index: number, address: string, lat: number, lng: number) => {
    if (useMergedMode && onPickupGroupsChange) {
      const newGroups = [...pickupGroups];
      newGroups[index].pickup = { ...newGroups[index].pickup, address, lat, lng };
      onPickupGroupsChange(newGroups);
    } else {
      const updated = [...pickups];
      updated[index] = { ...updated[index], address, lat, lng };
      onPickupsChange(updated);
    }
  };

  const updateDropoff = (pickupIndex: number, dropoffIndex: number, address: string, lat: number, lng: number) => {
    if (useMergedMode && onPickupGroupsChange) {
      const newGroups = [...pickupGroups];
      newGroups[pickupIndex].dropoffs[dropoffIndex] = {
        ...newGroups[pickupIndex].dropoffs[dropoffIndex],
        address,
        lat,
        lng
      };
      onPickupGroupsChange(newGroups);
    } else {
      const updated = [...dropoffs];
      updated[dropoffIndex] = { ...updated[dropoffIndex], address, lat, lng };
      onDropoffsChange(updated);
    }
  };

  const handlePickupDragStart = (index: number) => {
    setDraggedPickupIndex(index);
  };

  const handlePickupDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handlePickupDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedPickupIndex === null || draggedPickupIndex === index || !onPickupGroupsChange) {
      setDraggedPickupIndex(null);
      return;
    }

    const newGroups = [...pickupGroups];
    const draggedItem = newGroups[draggedPickupIndex];
    newGroups.splice(draggedPickupIndex, 1);
    newGroups.splice(index, 0, draggedItem);

    onPickupGroupsChange(newGroups);
    setDraggedPickupIndex(null);
  };

  const handlePickupDragEnd = () => {
    setDraggedPickupIndex(null);
  };

  const handleDropoffDragStart = (pickupIndex: number, dropoffIndex: number) => {
    setDraggedDropoffInfo({ pickupIndex, dropoffIndex });
  };

  const handleDropoffDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropoffDrop = (e: React.DragEvent, pickupIndex: number, dropoffIndex: number) => {
    e.preventDefault();
    if (!draggedDropoffInfo || !onPickupGroupsChange) {
      setDraggedDropoffInfo(null);
      return;
    }

    if (draggedDropoffInfo.pickupIndex !== pickupIndex) {
      setDraggedDropoffInfo(null);
      return;
    }

    if (draggedDropoffInfo.dropoffIndex === dropoffIndex) {
      setDraggedDropoffInfo(null);
      return;
    }

    const newGroups = [...pickupGroups];
    const dropoffs = newGroups[pickupIndex].dropoffs;
    const draggedItem = dropoffs[draggedDropoffInfo.dropoffIndex];
    dropoffs.splice(draggedDropoffInfo.dropoffIndex, 1);
    dropoffs.splice(dropoffIndex, 0, draggedItem);
    newGroups[pickupIndex].dropoffs = dropoffs;

    onPickupGroupsChange(newGroups);
    setDraggedDropoffInfo(null);
  };

  const handleDropoffDragEnd = () => {
    setDraggedDropoffInfo(null);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      return;
    }

    const newDropoffs = [...dropoffs];
    const draggedItem = newDropoffs[draggedIndex];
    newDropoffs.splice(draggedIndex, 1);
    newDropoffs.splice(index, 0, draggedItem);

    onDropoffsChange(newDropoffs);
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleCenterOnUser = () => {
    if (map && userLocation) {
      map.panTo(userLocation);
      map.setZoom(14);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((position) => {
        const location = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        setUserLocation(location);
        if (map) {
          map.panTo(location);
          map.setZoom(14);
        }
      });
    }
  };

  const getGlobalDropoffNumber = (pickupIndex: number, dropoffIndex: number): number => {
    let counter = 0;
    for (let i = 0; i < pickupIndex; i++) {
      counter += pickupGroups[i].dropoffs.length;
    }
    return counter + dropoffIndex + 1;
  };

  if (!mapsLoaded) {
    return (
      <div className="w-full rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-6">
        <div className="flex flex-col items-center text-center gap-3 py-6">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center">
            <MapPin className="w-7 h-7 text-gray-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Route map unavailable</p>
            <p className="text-xs text-gray-400 mt-1 max-w-xs">
              Google Maps API key is not configured. Stops can still be added using the address fields.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div ref={mapRef} className="w-full h-80 rounded-lg border-2 border-gray-300" />

        <button
          type="button"
          onClick={handleCenterOnUser}
          className="absolute top-3 right-3 p-3 bg-white rounded-lg shadow-lg border border-gray-200 hover:bg-gray-50 transition-all"
          title="Center on my location"
        >
          <Navigation className="w-5 h-5 text-gray-700" />
        </button>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-gray-700">
            <p className="font-semibold text-gray-900 mb-1">Multi-Stop Route Planning</p>
            <p className="text-xs">
              {useMergedMode
                ? 'Add pickup locations and the drop-offs linked to each pickup. You can drag to change the delivery order.'
                : hasMultiplePickups
                ? 'Route runs through all pickup stops first, then all drop-off stops in order.'
                : 'Route runs from the single pickup location through all drop-off stops in order.'}
            </p>
          </div>
        </div>
      </div>

      {showMultiplePickupsToggle && (
        <div className="border-2 border-purple-200 rounded-xl overflow-hidden">
          <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={hasMultiplePickups}
                onChange={(e) => onMultiplePickupsToggle(e.target.checked)}
                className="w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              />
              <div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-purple-600" />
                  <span className="font-semibold text-gray-900">Multiple pickup locations?</span>
                </div>
                <p className="text-xs text-gray-600 mt-1">
                  Enable this to collect cargo from multiple pickup points
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {useMergedMode ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900">Pickup & Drop-off Groups</h3>
            <button
              type="button"
              onClick={addPickup}
              className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all text-sm"
            >
              <Plus className="w-4 h-4" />
              Add Pickup Group
            </button>
          </div>

          {pickupGroups.map((group, pickupIndex) => (
            <div
              key={group.id}
              onDragOver={(e) => handlePickupDragOver(e, pickupIndex)}
              onDrop={(e) => handlePickupDrop(e, pickupIndex)}
              className={`border-2 border-gray-300 rounded-xl overflow-hidden transition-all ${
                draggedPickupIndex === pickupIndex ? 'opacity-50' : 'opacity-100'
              }`}
            >
              <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => handlePickupDragStart(pickupIndex)}
                    onDragEnd={handlePickupDragEnd}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="w-5 h-5" />
                  </button>
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">P{pickupIndex + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="font-semibold text-gray-900">Pickup Location</div>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => autocompleteRefs.current.get(`pickup-${group.id}`)?.toggleSavedPanel()}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                      >
                        <BookmarkPlus className="w-3.5 h-3.5" />
                        Use saved address
                      </button>
                    </div>
                    <GooglePlacesAutocomplete
                      ref={(el) => {
                        if (el) autocompleteRefs.current.set(`pickup-${group.id}`, el);
                        else autocompleteRefs.current.delete(`pickup-${group.id}`);
                      }}
                      value={group.pickup.address}
                      onChange={(text, lat, lng) => updatePickup(pickupIndex, text, lat, lng)}
                      placeholder={`Enter pickup location ${pickupIndex + 1}`}
                      label=""
                    />
                  </div>
                  {pickupGroups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePickup(pickupIndex)}
                      className="flex-shrink-0 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <span className="text-white text-xs font-bold">D</span>
                    </div>
                    Drop-off Stops for P{pickupIndex + 1}
                  </h4>
                  <button
                    type="button"
                    onClick={() => addDropoff(pickupIndex)}
                    className="flex items-center gap-2 px-2 py-1 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all text-xs"
                  >
                    <Plus className="w-3 h-3" />
                    Add Drop-off
                  </button>
                </div>

                {group.dropoffs.map((dropoff, dropoffIndex) => (
                  <div
                    key={dropoff.id}
                    onDragOver={handleDropoffDragOver}
                    onDrop={(e) => handleDropoffDrop(e, pickupIndex, dropoffIndex)}
                    className={`p-3 bg-green-50 border-2 border-green-200 rounded-lg transition-all ${
                      draggedDropoffInfo?.pickupIndex === pickupIndex && draggedDropoffInfo?.dropoffIndex === dropoffIndex
                        ? 'opacity-50'
                        : 'opacity-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        draggable
                        onDragStart={() => handleDropoffDragStart(pickupIndex, dropoffIndex)}
                        onDragEnd={handleDropoffDragEnd}
                        className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                      >
                        <GripVertical className="w-5 h-5" />
                      </button>
                      <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-sm font-bold">
                          {getGlobalDropoffNumber(pickupIndex, dropoffIndex)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-end mb-1">
                          <button
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => autocompleteRefs.current.get(`dropoff-${dropoff.id}`)?.toggleSavedPanel()}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                          >
                            <BookmarkPlus className="w-3.5 h-3.5" />
                            Use saved address
                          </button>
                        </div>
                        <GooglePlacesAutocomplete
                          ref={(el) => {
                            if (el) autocompleteRefs.current.set(`dropoff-${dropoff.id}`, el);
                            else autocompleteRefs.current.delete(`dropoff-${dropoff.id}`);
                          }}
                          value={dropoff.address}
                          onChange={(text, lat, lng) => updateDropoff(pickupIndex, dropoffIndex, text, lat, lng)}
                          placeholder={`Enter drop-off location`}
                          label=""
                        />
                      </div>
                      {group.dropoffs.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeDropoff(pickupIndex, dropoffIndex)}
                          className="flex-shrink-0 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">P</span>
                </div>
                Pickup Location{hasMultiplePickups ? 's' : ''}
              </h3>
              {hasMultiplePickups && (
                <button
                  type="button"
                  onClick={addPickup}
                  className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Add Pickup
                </button>
              )}
            </div>

            {pickups.map((pickup, index) => (
              <div key={pickup.id} className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">
                      {hasMultiplePickups ? `P${index + 1}` : 'P'}
                    </span>
                  </div>
                  <div className="flex-1">
                    <GooglePlacesAutocomplete
                      value={pickup.address}
                      onChange={(text, lat, lng) => updatePickup(index, text, lat, lng)}
                      placeholder={`Enter pickup location ${hasMultiplePickups ? `${index + 1}` : ''}`}
                      label=""
                    />
                  </div>
                  {hasMultiplePickups && pickups.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removePickup(index)}
                      className="flex-shrink-0 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs font-bold">D</span>
                </div>
                Drop-off Stops
              </h3>
              <button
                type="button"
                onClick={() => addDropoff()}
                className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Stop
              </button>
            </div>

            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Drag to reorder:</span> Hold and drag stops to change delivery order. Stop numbers will update automatically.
              </p>
            </div>

            {dropoffs.map((dropoff, index) => (
              <div
                key={dropoff.id}
                onDragOver={(e) => handleDragOver(e, index)}
                onDrop={(e) => handleDrop(e, index)}
                className={`p-4 bg-green-50 border-2 border-green-200 rounded-lg transition-all ${
                  draggedIndex === index ? 'opacity-50' : 'opacity-100'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnd={handleDragEnd}
                    className="flex-shrink-0 p-2 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing"
                  >
                    <GripVertical className="w-5 h-5" />
                  </button>
                  <div className="flex-shrink-0 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <GooglePlacesAutocomplete
                      value={dropoff.address}
                      onChange={(text, lat, lng) => updateDropoff(0, index, text, lat, lng)}
                      placeholder={`Enter drop-off location ${index + 1}`}
                      label=""
                    />
                  </div>
                  {dropoffs.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeDropoff(0, index)}
                      className="flex-shrink-0 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
