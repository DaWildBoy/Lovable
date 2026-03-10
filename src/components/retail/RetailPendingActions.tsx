import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { AlertCircle, Star, DollarSign, ChevronRight, Eye } from 'lucide-react';

interface PendingAction {
  type: string;
  jobId: string;
  title: string;
  subtitle: string;
  icon: typeof AlertCircle;
  iconBg: string;
  iconColor: string;
}

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

export function RetailPendingActions({ userId, onNavigate }: Props) {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingActions();
  }, [userId]);

  const fetchPendingActions = async () => {
    try {
      const results: PendingAction[] = [];

      const { data: counterOffers } = await supabase
        .from('counter_offers')
        .select('id, job_id, amount_ttd, offered_by_role')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .eq('offered_by_role', 'courier')
        .order('created_at', { ascending: false })
        .limit(3);

      if (counterOffers) {
        for (const offer of counterOffers) {
          results.push({
            type: 'counter_offer',
            jobId: offer.job_id,
            title: `Counter offer: TTD $${offer.amount_ttd}`,
            subtitle: 'A courier has proposed a different rate',
            icon: DollarSign,
            iconBg: 'bg-warning-50',
            iconColor: 'text-warning-600',
          });
        }
      }

      const { data: completedJobs } = await supabase
        .from('jobs')
        .select('id, pickup_location_text, dropoff_location_text')
        .eq('customer_user_id', userId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (completedJobs && completedJobs.length > 0) {
        const jobIds = completedJobs.map(j => j.id);
        const { data: ratings } = await supabase
          .from('provider_ratings')
          .select('job_id')
          .in('job_id', jobIds);

        const ratedJobIds = new Set(ratings?.map(r => r.job_id) || []);
        let unratedCount = 0;

        for (const job of completedJobs) {
          if (!ratedJobIds.has(job.id) && unratedCount < 2) {
            results.push({
              type: 'unrated',
              jobId: job.id,
              title: 'Rate your delivery',
              subtitle: `${job.pickup_location_text?.split(',')[0]} to ${job.dropoff_location_text?.split(',')[0]}`,
              icon: Star,
              iconBg: 'bg-amber-50',
              iconColor: 'text-amber-500',
            });
            unratedCount++;
          }
        }
      }

      const { data: deliveredJobs } = await supabase
        .from('jobs')
        .select('id, dropoff_location_text')
        .eq('customer_user_id', userId)
        .eq('status', 'delivered')
        .order('updated_at', { ascending: false })
        .limit(2);

      if (deliveredJobs) {
        for (const job of deliveredJobs) {
          results.push({
            type: 'delivered',
            jobId: job.id,
            title: 'View proof of delivery',
            subtitle: `Delivered to ${job.dropoff_location_text?.split(',')[0]}`,
            icon: Eye,
            iconBg: 'bg-moveme-blue-50',
            iconColor: 'text-moveme-blue-600',
          });
        }
      }

      setActions(results);
    } catch (error) {
      console.error('Error fetching pending actions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || actions.length === 0) return null;

  return (
    <div className="card p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 bg-warning-500 rounded-full animate-pulse" />
        <h3 className="text-sm font-bold text-gray-900">Needs Your Attention</h3>
        <span className="ml-auto bg-warning-100 text-warning-700 text-xs font-bold px-2 py-0.5 rounded-full">
          {actions.length}
        </span>
      </div>

      <div className="space-y-1">
        {actions.map((action, idx) => {
          const Icon = action.icon;
          return (
            <button
              key={`${action.type}-${action.jobId}-${idx}`}
              onClick={() => onNavigate(`/job/${action.jobId}`)}
              className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-all active:scale-[0.99] text-left group"
            >
              <div className={`w-9 h-9 ${action.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${action.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                <p className="text-xs text-gray-500 truncate">{action.subtitle}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
