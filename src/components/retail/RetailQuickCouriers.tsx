import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Star, ChevronRight, UserPlus } from 'lucide-react';

interface PreferredCourier {
  id: string;
  courier_name: string;
  avatar_url: string | null;
  company_name: string | null;
}

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

export function RetailQuickCouriers({ userId, onNavigate }: Props) {
  const [couriers, setCouriers] = useState<PreferredCourier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCouriers();
  }, [userId]);

  const fetchCouriers = async () => {
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('id, user_id, profiles:user_id(full_name, avatar_url, company_name)')
        .limit(0);

      if (error) {
        setCouriers([]);
      } else {
        setCouriers([]);
      }
    } catch {
      setCouriers([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-gray-900">Preferred Couriers</h3>
        </div>
        <button
          onClick={() => onNavigate('/business/profile?tab=couriers')}
          className="text-xs font-medium text-moveme-blue-600 hover:text-moveme-blue-700 flex items-center gap-0.5"
        >
          Manage
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {couriers.length === 0 ? (
        <button
          onClick={() => onNavigate('/business/profile?tab=couriers')}
          className="w-full flex items-center justify-center gap-2 py-5 border-2 border-dashed border-gray-200 rounded-xl text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span className="text-sm font-medium">Add preferred couriers</span>
        </button>
      ) : (
        <div className="space-y-2">
          {couriers.map((courier) => (
            <div
              key={courier.id}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 transition-all"
            >
              {courier.avatar_url ? (
                <img
                  src={courier.avatar_url}
                  alt={courier.courier_name}
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-bold text-gray-500">
                    {courier.courier_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{courier.courier_name}</p>
                {courier.company_name && (
                  <p className="text-[10px] text-gray-400 truncate">{courier.company_name}</p>
                )}
              </div>
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-50 rounded-md">
                <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                <span className="text-[10px] text-amber-600 font-semibold">Preferred</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
