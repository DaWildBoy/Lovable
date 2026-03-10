import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Star, ChevronRight } from 'lucide-react';

interface UnratedJob {
  id: string;
  pickup_location_text: string;
  dropoff_location_text: string;
  courier_name: string;
  updated_at: string | null;
}

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

export function RateLastDelivery({ userId, onNavigate }: Props) {
  const [job, setJob] = useState<UnratedJob | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    findUnratedDelivery();
  }, [userId]);

  const findUnratedDelivery = async () => {
    try {
      const { data: completedJobs } = await supabase
        .from('jobs')
        .select('id, pickup_location_text, dropoff_location_text, assigned_courier_id, assigned_driver_name, updated_at')
        .eq('customer_user_id', userId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(5);

      if (!completedJobs || completedJobs.length === 0) return;

      const jobIds = completedJobs.map(j => j.id);
      const { data: ratings } = await supabase
        .from('provider_ratings')
        .select('job_id')
        .in('job_id', jobIds);

      const ratedIds = new Set(ratings?.map(r => r.job_id) || []);
      const unrated = completedJobs.find(j => !ratedIds.has(j.id));

      if (!unrated) return;

      let courierName = unrated.assigned_driver_name || 'your courier';
      if (unrated.assigned_courier_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', unrated.assigned_courier_id)
          .maybeSingle();

        if (profile) {
          courierName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || courierName;
        }
      }

      setJob({
        id: unrated.id,
        pickup_location_text: unrated.pickup_location_text,
        dropoff_location_text: unrated.dropoff_location_text,
        courier_name: courierName,
        updated_at: unrated.updated_at,
      });
    } catch (error) {
      console.error('Error finding unrated delivery:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !job) return null;

  const completedDate = job.updated_at
    ? new Date(job.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/80 rounded-xl flex items-center justify-center shadow-sm">
            <Star className="w-5 h-5 text-amber-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900">How was your delivery?</p>
            <p className="text-xs text-gray-500 truncate">
              By {job.courier_name} {completedDate && `on ${completedDate}`}
            </p>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => onNavigate(`/job/${job.id}`)}
              className="p-0.5 hover:scale-125 transition-transform"
            >
              <Star className="w-6 h-6 text-gray-200 hover:text-amber-400 hover:fill-amber-400 transition-colors" />
            </button>
          ))}
        </div>
        <button
          onClick={() => onNavigate(`/job/${job.id}`)}
          className="text-xs text-moveme-blue-600 font-semibold flex items-center gap-0.5 hover:text-moveme-blue-700 transition-colors"
        >
          Review
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
