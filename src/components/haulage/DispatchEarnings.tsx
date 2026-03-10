import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { DollarSign, TrendingUp, TrendingDown, Minus, Calendar } from 'lucide-react';
import { fetchPlatformFeePercentage } from '../../lib/pricing';

interface EarningsData {
  todayEarnings: number;
  todayJobs: number;
  weekEarnings: number;
  weekJobs: number;
  monthEarnings: number;
  monthJobs: number;
  lastWeekEarnings: number;
}

export function DispatchEarnings() {
  const { profile } = useAuth();
  const [data, setData] = useState<EarningsData>({
    todayEarnings: 0, todayJobs: 0,
    weekEarnings: 0, weekJobs: 0,
    monthEarnings: 0, monthJobs: 0,
    lastWeekEarnings: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchEarnings();
  }, [profile?.id]);

  const fetchEarnings = async () => {
    try {
      const feeRate = await fetchPlatformFeePercentage();
      const now = new Date();

      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      weekStart.setHours(0, 0, 0, 0);

      const lastWeekStart = new Date(weekStart);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);

      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('customer_offer_ttd, driver_net_earnings, updated_at, created_at')
        .eq('assigned_company_id', profile!.id)
        .eq('status', 'completed');

      if (error) throw error;

      let todayEarnings = 0, todayJobs = 0;
      let weekEarnings = 0, weekJobs = 0;
      let monthEarnings = 0, monthJobs = 0;
      let lastWeekEarnings = 0;

      (jobs || []).forEach((job: any) => {
        const completedAt = new Date(job.updated_at || job.created_at);
        const amount = job.driver_net_earnings ?? Math.round((job.customer_offer_ttd || 0) * (1 - feeRate) * 100) / 100;

        if (completedAt >= new Date(todayStart)) {
          todayEarnings += amount;
          todayJobs++;
        }
        if (completedAt >= weekStart) {
          weekEarnings += amount;
          weekJobs++;
        }
        if (completedAt >= lastWeekStart && completedAt < weekStart) {
          lastWeekEarnings += amount;
        }
        if (completedAt >= new Date(monthStart)) {
          monthEarnings += amount;
          monthJobs++;
        }
      });

      setData({ todayEarnings, todayJobs, weekEarnings, weekJobs, monthEarnings, monthJobs, lastWeekEarnings });
    } catch (err) {
      console.error('Error fetching earnings:', err);
    } finally {
      setLoading(false);
    }
  };

  const weekChange = data.lastWeekEarnings > 0
    ? ((data.weekEarnings - data.lastWeekEarnings) / data.lastWeekEarnings * 100)
    : data.weekEarnings > 0 ? 100 : 0;

  if (loading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="h-4 bg-gray-200 rounded w-32" />
        </div>
        <div className="h-8 bg-gray-200 rounded w-40 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-24" />
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-br from-emerald-600 to-emerald-700 p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-white/90">Today's Revenue</h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <Calendar className="w-3 h-3 text-white/60" />
            <span className="text-white/60">{new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          </div>
        </div>

        <div className="flex items-end gap-2 mb-1">
          <span className="text-3xl font-bold tracking-tight">
            ${data.todayEarnings.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </span>
          <span className="text-sm text-white/60 mb-1">TTD</span>
        </div>
        <p className="text-xs text-white/60">
          {data.todayJobs} {data.todayJobs === 1 ? 'delivery' : 'deliveries'} completed today
        </p>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">This Week</p>
            <p className="text-lg font-bold text-gray-900">
              ${data.weekEarnings.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {weekChange > 0 ? (
                <TrendingUp className="w-3 h-3 text-success-600" />
              ) : weekChange < 0 ? (
                <TrendingDown className="w-3 h-3 text-error-600" />
              ) : (
                <Minus className="w-3 h-3 text-gray-400" />
              )}
              <span className={`text-[10px] font-medium ${
                weekChange > 0 ? 'text-success-600' : weekChange < 0 ? 'text-error-600' : 'text-gray-400'
              }`}>
                {weekChange > 0 ? '+' : ''}{weekChange.toFixed(0)}% vs last week
              </span>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl p-3">
            <p className="text-xs text-gray-500 mb-1">This Month</p>
            <p className="text-lg font-bold text-gray-900">
              ${data.monthEarnings.toLocaleString('en-US', { minimumFractionDigits: 0 })}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">
              {data.monthJobs} {data.monthJobs === 1 ? 'job' : 'jobs'} completed
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
