import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { CheckCircle2, XCircle, TrendingUp } from 'lucide-react';

interface Props {
  userId: string;
  courierId: string;
}

export function CourierQuickStats({ userId, courierId }: Props) {
  const [completionRate, setCompletionRate] = useState(0);
  const [totalJobs, setTotalJobs] = useState(0);
  const [cancelledJobs, setCancelledJobs] = useState(0);

  useEffect(() => {
    fetchStats();
  }, [userId, courierId]);

  const fetchStats = async () => {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const [completedRes, cancelledRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_courier_id', courierId)
          .eq('status', 'completed')
          .gte('updated_at', thirtyDaysAgo),
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('assigned_courier_id', courierId)
          .eq('status', 'cancelled')
          .gte('updated_at', thirtyDaysAgo),
      ]);

      const completed = completedRes.count || 0;
      const cancelled = cancelledRes.count || 0;
      const total = completed + cancelled;

      setTotalJobs(completed);
      setCancelledJobs(cancelled);
      setCompletionRate(total > 0 ? Math.round((completed / total) * 100) : 100);
    } catch (err) {
      console.error('Error fetching quick stats:', err);
    }
  };

  const rateColor = completionRate >= 90 ? 'text-emerald-600' : completionRate >= 70 ? 'text-amber-600' : 'text-red-600';
  const rateBg = completionRate >= 90 ? 'from-emerald-400 to-green-500' : completionRate >= 70 ? 'from-amber-400 to-orange-500' : 'from-red-400 to-red-500';
  const rateTrack = completionRate >= 90 ? 'text-emerald-100' : completionRate >= 70 ? 'text-amber-100' : 'text-red-100';
  const rateStroke = completionRate >= 90 ? 'text-emerald-500' : completionRate >= 70 ? 'text-amber-500' : 'text-red-500';

  const circumference = 2 * Math.PI * 36;
  const strokeDashoffset = circumference - (completionRate / 100) * circumference;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-bold text-gray-900">Last 30 Days</h3>
      </div>

      <div className="flex items-center gap-5">
        <div className="relative flex-shrink-0">
          <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
            <circle
              cx="44" cy="44" r="36"
              fill="none"
              strokeWidth="6"
              className={rateTrack}
              stroke="currentColor"
            />
            <circle
              cx="44" cy="44" r="36"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              className={rateStroke}
              stroke="currentColor"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: 'stroke-dashoffset 1s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-lg font-bold ${rateColor} tabular-nums leading-none`}>{completionRate}%</span>
            <span className="text-[9px] text-gray-400 font-medium mt-0.5">Rate</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-green-500 rounded-lg flex items-center justify-center shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-lg font-bold text-gray-900 tabular-nums leading-none">{totalJobs}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">Completed</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${
              cancelledJobs === 0
                ? 'bg-gray-100'
                : 'bg-gradient-to-br from-red-400 to-red-500'
            }`}>
              <XCircle className={`w-4 h-4 ${cancelledJobs === 0 ? 'text-gray-400' : 'text-white'}`} />
            </div>
            <div className="flex-1">
              <p className={`text-lg font-bold tabular-nums leading-none ${cancelledJobs === 0 ? 'text-gray-400' : 'text-gray-900'}`}>{cancelledJobs}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">Cancelled</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
