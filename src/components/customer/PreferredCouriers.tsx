import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Star, Award, User } from 'lucide-react';

interface TopCourier {
  id: string;
  name: string;
  avatar_url: string | null;
  avgRating: number;
  deliveryCount: number;
}

interface Props {
  userId: string;
}

export function PreferredCouriers({ userId }: Props) {
  const [couriers, setCouriers] = useState<TopCourier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPreferredCouriers();
  }, [userId]);

  const fetchPreferredCouriers = async () => {
    try {
      const { data: ratings } = await supabase
        .from('provider_ratings')
        .select('provider_id, stars')
        .eq('rater_user_id', userId)
        .gte('stars', 4);

      if (!ratings || ratings.length === 0) return;

      const courierStats: Record<string, { totalStars: number; count: number }> = {};
      for (const r of ratings) {
        if (!courierStats[r.provider_id]) {
          courierStats[r.provider_id] = { totalStars: 0, count: 0 };
        }
        courierStats[r.provider_id].totalStars += r.stars;
        courierStats[r.provider_id].count += 1;
      }

      const sorted = Object.entries(courierStats)
        .map(([id, s]) => ({ id, avg: s.totalStars / s.count, count: s.count }))
        .sort((a, b) => b.avg - a.avg || b.count - a.count)
        .slice(0, 4);

      if (sorted.length === 0) return;

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, avatar_url')
        .in('id', sorted.map(s => s.id));

      const profileMap = Object.fromEntries(
        (profiles || []).map(p => [p.id, p])
      );

      setCouriers(sorted.map(s => {
        const p = profileMap[s.id];
        return {
          id: s.id,
          name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Courier' : 'Courier',
          avatar_url: p?.avatar_url || null,
          avgRating: Math.round(s.avg * 10) / 10,
          deliveryCount: s.count,
        };
      }));
    } catch (error) {
      console.error('Error fetching preferred couriers:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || couriers.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Award className="w-4 h-4 text-amber-500" />
        <h3 className="text-sm font-bold text-gray-900">Your Top Couriers</h3>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {couriers.map((courier) => (
          <div
            key={courier.id}
            className="flex items-center gap-2.5 p-2.5 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
          >
            {courier.avatar_url ? (
              <img
                src={courier.avatar_url}
                alt={courier.name}
                className="w-9 h-9 rounded-xl object-cover"
              />
            ) : (
              <div className="w-9 h-9 bg-moveme-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-moveme-blue-400" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 truncate">{courier.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <div className="flex items-center gap-0.5">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                  <span className="text-[10px] font-bold text-gray-700">{courier.avgRating}</span>
                </div>
                <span className="text-[10px] text-gray-400">
                  {courier.deliveryCount} {courier.deliveryCount === 1 ? 'trip' : 'trips'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
