import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Plus, ChevronRight } from 'lucide-react';

interface SavedLocation {
  id: string;
  nickname: string;
  full_address: string;
  latitude: number;
  longitude: number;
}

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

export function SavedAddressesQuick({ userId, onNavigate }: Props) {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSavedLocations();
  }, [userId]);

  const fetchSavedLocations = async () => {
    try {
      const { data } = await supabase
        .from('saved_locations')
        .select('id, nickname, full_address, latitude, longitude')
        .eq('user_id', userId)
        .order('usage_count', { ascending: false })
        .limit(5);

      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching saved locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = (loc: SavedLocation) => {
    const params = new URLSearchParams({
      pickup: loc.full_address,
      pickup_lat: String(loc.latitude),
      pickup_lng: String(loc.longitude),
    });
    onNavigate(`/create-job?${params.toString()}`);
  };

  if (loading || locations.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-moveme-blue-600" />
          <h3 className="text-sm font-bold text-gray-900">Saved Addresses</h3>
        </div>
        <button
          onClick={() => onNavigate('/address-book')}
          className="text-xs text-moveme-blue-600 font-medium hover:text-moveme-blue-700 transition-colors flex items-center gap-0.5"
        >
          Manage
          <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-1 px-1">
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => handleClick(loc)}
            className="flex-shrink-0 flex items-center gap-2 pl-2 pr-3 py-2 rounded-xl border border-gray-100 hover:border-moveme-blue-200 hover:bg-moveme-blue-50/30 transition-all active:scale-[0.97] max-w-[200px]"
          >
            <div className="w-7 h-7 bg-moveme-blue-50 rounded-lg flex items-center justify-center flex-shrink-0">
              <MapPin className="w-3.5 h-3.5 text-moveme-blue-600" />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-xs font-semibold text-gray-900 truncate">{loc.nickname}</p>
              <p className="text-[10px] text-gray-400 truncate">{loc.full_address.split(',')[0]}</p>
            </div>
          </button>
        ))}

        <button
          onClick={() => onNavigate('/address-book')}
          className="flex-shrink-0 flex items-center gap-2 pl-2 pr-3 py-2 rounded-xl border border-dashed border-gray-200 hover:border-moveme-blue-300 hover:bg-moveme-blue-50/20 transition-all active:scale-[0.97]"
        >
          <div className="w-7 h-7 bg-gray-50 rounded-lg flex items-center justify-center">
            <Plus className="w-3.5 h-3.5 text-gray-400" />
          </div>
          <span className="text-xs text-gray-500 font-medium">Add New</span>
        </button>
      </div>
    </div>
  );
}
