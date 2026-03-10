import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { RotateCcw, ArrowRight } from 'lucide-react';

type Job = Database['public']['Tables']['jobs']['Row'];

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

export function QuickRebook({ userId, onNavigate }: Props) {
  const [routes, setRoutes] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecentRoutes();
  }, [userId]);

  const fetchRecentRoutes = async () => {
    try {
      const { data } = await supabase
        .from('jobs')
        .select('id, pickup_location_text, dropoff_location_text, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng, customer_offer_ttd, distance_km')
        .eq('customer_user_id', userId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(6);

      const seen = new Set<string>();
      const unique: Job[] = [];
      for (const job of (data || [])) {
        const key = `${job.pickup_location_text}-${job.dropoff_location_text}`;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(job as Job);
        }
        if (unique.length >= 3) break;
      }
      setRoutes(unique);
    } catch (error) {
      console.error('Error fetching recent routes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRebook = (job: Job) => {
    const params = new URLSearchParams({
      pickup: job.pickup_location_text,
      dropoff: job.dropoff_location_text,
      pickup_lat: String(job.pickup_lat),
      pickup_lng: String(job.pickup_lng),
      dropoff_lat: String(job.dropoff_lat),
      dropoff_lng: String(job.dropoff_lng),
    });
    onNavigate(`/create-job?${params.toString()}`);
  };

  if (loading || routes.length === 0) return null;

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-3">
        <RotateCcw className="w-4 h-4 text-moveme-blue-600" />
        <h3 className="text-sm font-bold text-gray-900">Quick Rebook</h3>
      </div>

      <div className="space-y-2">
        {routes.map((job) => (
          <button
            key={job.id}
            onClick={() => handleRebook(job)}
            className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-moveme-blue-200 hover:bg-moveme-blue-50/30 transition-all active:scale-[0.99] text-left group"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-success-500 flex-shrink-0" />
                <p className="text-xs font-medium text-gray-700 truncate">
                  {job.pickup_location_text?.split(',')[0]}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-error-500 flex-shrink-0" />
                <p className="text-xs text-gray-500 truncate">
                  {job.dropoff_location_text?.split(',')[0]}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-moveme-blue-600 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <span className="text-xs font-semibold">Book</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
