import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, MapPin, ChevronRight, RefreshCw, Clock, CheckCircle, Truck, AlertCircle } from 'lucide-react';

interface RecentJob {
  id: string;
  job_reference_id: string | null;
  status: string | null;
  pickup_location_text: string;
  dropoff_location_text: string;
  customer_total: number | null;
  created_at: string | null;
  job_type: string;
}

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  completed: { label: 'Completed', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
  delivered: { label: 'Delivered', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-50' },
  in_transit: { label: 'In Transit', icon: Truck, color: 'text-blue-600 bg-blue-50' },
  in_progress: { label: 'In Progress', icon: Truck, color: 'text-blue-600 bg-blue-50' },
  assigned: { label: 'Assigned', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  open: { label: 'Open', icon: Clock, color: 'text-sky-600 bg-sky-50' },
  cancelled: { label: 'Cancelled', icon: AlertCircle, color: 'text-red-600 bg-red-50' },
};

export function CustomerProfileRecentDeliveries({ userId, onNavigate }: Props) {
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRecent();
  }, [userId]);

  const fetchRecent = async () => {
    try {
      const { data } = await supabase
        .from('jobs')
        .select('id, job_reference_id, status, pickup_location_text, dropoff_location_text, customer_total, created_at, job_type')
        .eq('customer_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      setJobs(data || []);
    } catch (err) {
      console.error('Error fetching recent deliveries:', err);
    } finally {
      setLoading(false);
    }
  };

  const truncateAddress = (addr: string) => {
    if (addr.length <= 35) return addr;
    return addr.substring(0, 35) + '...';
  };

  const formatDate = (date: string | null) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Deliveries</h2>
          </div>
          <div className="card overflow-hidden">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border-b border-gray-50 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-xl" />
                  <div className="flex-1">
                    <div className="h-4 bg-gray-100 rounded w-40 mb-2" />
                    <div className="h-3 bg-gray-100 rounded w-56" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className="px-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Deliveries</h2>
          </div>
          <div className="card p-8 text-center">
            <Package className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No deliveries yet</p>
            <p className="text-xs text-gray-400 mt-1">Your recent deliveries will appear here</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Deliveries</h2>
          <button
            onClick={() => onNavigate('/customer/jobs')}
            className="text-xs font-medium text-moveme-blue-600 hover:text-moveme-blue-700 transition-colors"
          >
            View All
          </button>
        </div>
        <div className="card overflow-hidden">
          {jobs.map((job, index) => {
            const config = statusConfig[job.status || 'open'] || statusConfig.open;
            const StatusIcon = config.icon;
            const isLast = index === jobs.length - 1;
            const isRebookable = job.status === 'completed' || job.status === 'delivered';

            return (
              <div
                key={job.id}
                className={`group ${!isLast ? 'border-b border-gray-50' : ''}`}
              >
                <button
                  onClick={() => onNavigate(`/job/${job.id}`)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50/50 transition-all text-left"
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${config.color}`}>
                    <StatusIcon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-gray-900">
                        {job.job_reference_id || 'Job'}
                      </p>
                      <span className="text-xs text-gray-400">{formatDate(job.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{truncateAddress(job.dropoff_location_text)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {job.customer_total ? (
                      <span className="text-sm font-semibold text-gray-700">
                        ${Number(job.customer_total).toFixed(0)}
                      </span>
                    ) : null}
                    {isRebookable && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('/create-job');
                        }}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Rebook"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
