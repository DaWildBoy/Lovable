import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { MapPin, Bookmark, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SavedLocation {
  id: string;
  nickname: string;
  full_address: string;
  latitude: number;
  longitude: number;
  source: 'saved_addresses' | 'saved_locations';
}

interface GooglePlacesAutocompleteProps {
  value: string;
  onChange: (value: string, lat: number, lng: number) => void;
  placeholder: string;
  label: string;
}

export interface GooglePlacesAutocompleteRef {
  toggleSavedPanel: () => void;
}

export const GooglePlacesAutocomplete = forwardRef<GooglePlacesAutocompleteRef, GooglePlacesAutocompleteProps>(({
  value,
  onChange,
  placeholder,
  label
}, ref) => {
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pacContainerRef = useRef<HTMLElement | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [filteredLocations, setFilteredLocations] = useState<SavedLocation[]>([]);
  const [showSavedPanel, setShowSavedPanel] = useState(false);
  const [searchText, setSearchText] = useState('');
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useImperativeHandle(ref, () => ({
    toggleSavedPanel: () => {
      if (showSavedPanel) {
        setShowSavedPanel(false);
        setSearchText('');
      } else {
        setFilteredLocations(savedLocations);
        setSearchText('');
        setShowSavedPanel(true);
        if (inputRef.current) inputRef.current.focus();
      }
    }
  }), [showSavedPanel, savedLocations]);

  useEffect(() => {
    loadSavedLocations();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (containerRef.current && !containerRef.current.contains(target)) {
        setShowSavedPanel(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!pacContainerRef.current) return;
    if (showSavedPanel) {
      pacContainerRef.current.classList.add('pac-container-force-hide');
    } else {
      pacContainerRef.current.classList.remove('pac-container-force-hide');
    }
  }, [showSavedPanel]);

  useEffect(() => {
    if (!window.google || !inputRef.current) return;

    const existingPacs = new Set(document.querySelectorAll('.pac-container'));

    const autocompleteInstance = new window.google.maps.places.Autocomplete(
      inputRef.current,
      {
        componentRestrictions: { country: 'tt' },
        fields: ['formatted_address', 'geometry']
      }
    );

    requestAnimationFrame(() => {
      const allPacs = document.querySelectorAll('.pac-container');
      allPacs.forEach(pac => {
        if (!existingPacs.has(pac)) {
          pacContainerRef.current = pac as HTMLElement;
        }
      });
    });

    autocompleteInstance.addListener('place_changed', () => {
      const place = autocompleteInstance.getPlace();
      if (place.geometry?.location) {
        onChangeRef.current(
          place.formatted_address || '',
          place.geometry.location.lat(),
          place.geometry.location.lng()
        );
        setShowSavedPanel(false);
      }
    });

    return () => {
      google.maps.event.clearInstanceListeners(autocompleteInstance);
      if (pacContainerRef.current) {
        pacContainerRef.current.remove();
        pacContainerRef.current = null;
      }
    };
  }, []);

  const loadSavedLocations = async () => {
    if (!user) return;

    try {
      const merged: SavedLocation[] = [];

      const { data: addresses } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (addresses) {
        for (const a of addresses) {
          merged.push({
            id: a.id,
            nickname: a.label,
            full_address: a.address_text,
            latitude: Number(a.lat) || 0,
            longitude: Number(a.lng) || 0,
            source: 'saved_addresses',
          });
        }
      }

      const { data: locations } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false });

      if (locations) {
        const existingAddresses = new Set(merged.map(m => m.full_address.toLowerCase()));
        for (const loc of locations) {
          if (!existingAddresses.has(loc.full_address.toLowerCase())) {
            merged.push({
              id: loc.id,
              nickname: loc.nickname,
              full_address: loc.full_address,
              latitude: loc.latitude,
              longitude: loc.longitude,
              source: 'saved_locations',
            });
          }
        }
      }

      setSavedLocations(merged);
    } catch (error) {
      console.error('Error loading saved locations:', error);
    }
  };

  const handleInputChange = (inputValue: string) => {
    onChangeRef.current(inputValue, 0, 0);
    if (showSavedPanel) {
      filterSavedLocations(inputValue);
    }
  };

  const filterSavedLocations = (text: string) => {
    setSearchText(text);
    if (text.trim()) {
      const filtered = savedLocations.filter(
        (loc) =>
          loc.nickname.toLowerCase().includes(text.toLowerCase()) ||
          loc.full_address.toLowerCase().includes(text.toLowerCase())
      );
      setFilteredLocations(filtered);
    } else {
      setFilteredLocations(savedLocations);
    }
  };

  const handleSelectSavedLocation = (location: SavedLocation) => {
    setShowSavedPanel(false);
    setFilteredLocations([]);
    setSearchText('');

    if (inputRef.current) {
      inputRef.current.value = location.full_address;
      inputRef.current.blur();
    }

    onChangeRef.current(location.full_address, location.latitude, location.longitude);
  };

  return (
    <div ref={containerRef}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label} <span className="text-red-500">*</span>
        </label>
      )}
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={placeholder}
          required
        />

        {showSavedPanel && (
          <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto"
            style={{ zIndex: 9999, top: '100%' }}
          >
            <div className="p-2 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
              <p className="text-xs font-medium text-blue-900 flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-blue-600" />
                Saved Locations
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowSavedPanel(false);
                  setSearchText('');
                }}
                className="p-0.5 hover:bg-blue-200 rounded transition-colors"
              >
                <X className="w-3.5 h-3.5 text-blue-700" />
              </button>
            </div>
            {filteredLocations.length > 0 ? (
              filteredLocations.map((location) => (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => handleSelectSavedLocation(location)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-start gap-3">
                    <Bookmark className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate text-sm">
                        {location.nickname}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {location.full_address}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            ) : (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No matching saved addresses
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
