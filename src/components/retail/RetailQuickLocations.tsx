import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MapPin, Star, Plus, ChevronRight } from 'lucide-react';

interface SavedLocation {
  id: string;
  location_name: string;
  address_text: string;
  is_default_pickup: boolean;
}

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

export function RetailQuickLocations({ userId, onNavigate }: Props) {
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLocations();
  }, [userId]);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('saved_locations')
        .select('id, nickname, full_address')
        .eq('user_id', userId)
        .order('usage_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      setLocations((data || []).map(d => ({
        id: d.id,
        location_name: d.nickname || 'Saved Location',
        address_text: d.full_address || '',
        is_default_pickup: false,
      })));
    } catch (err) {
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="card p-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-success-600" />
          <h3 className="text-sm font-bold text-gray-900">Quick Locations</h3>
        </div>
        <button
          onClick={() => onNavigate('/business/profile?tab=locations')}
          className="text-xs font-medium text-moveme-blue-600 hover:text-moveme-blue-700 flex items-center gap-0.5"
        >
          Manage
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {locations.length === 0 ? (
        <button
          onClick={() => onNavigate('/business/profile?tab=locations')}
          className="w-full flex items-center justify-center gap-2 py-6 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add your first location</span>
        </button>
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {locations.map((loc) => (
            <button
              key={loc.id}
              onClick={() => onNavigate('/create-job')}
              className="flex-shrink-0 w-40 border border-gray-100 rounded-xl p-3 hover:bg-gray-50 hover:border-gray-200 transition-all active:scale-[0.98] text-left group"
            >
              <div className="flex items-center gap-1.5 mb-1.5">
                <MapPin className="w-3 h-3 text-success-500 flex-shrink-0" />
                <span className="text-xs font-bold text-gray-900 truncate">{loc.location_name}</span>
                {loc.is_default_pickup && (
                  <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-[10px] text-gray-400 leading-tight line-clamp-2">{loc.address_text}</p>
            </button>
          ))}
          <button
            onClick={() => onNavigate('/business/profile?tab=locations')}
            className="flex-shrink-0 w-20 flex flex-col items-center justify-center border border-dashed border-gray-200 rounded-xl hover:border-gray-300 transition-all"
          >
            <Plus className="w-4 h-4 text-gray-300" />
            <span className="text-[10px] text-gray-400 mt-1">Add</span>
          </button>
        </div>
      )}
    </div>
  );
}
