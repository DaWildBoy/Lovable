import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { BarChart3, Clock, CheckCircle, Target, TrendingUp } from 'lucide-react';

interface WeekData {
  label: string;
  count: number;
}

interface Metrics {
  onTimeRate: number;
  avgCompletionHours: number;
  totalCompleted: number;
  totalCancelled: number;
  weeklyTrend: WeekData[];
}

export function DispatchPerformanceMetrics() {
  const { profile } = useAuth();
  const [metrics, setMetrics] = useState<Metrics>({
    onTimeRate: 0, avgCompletionHours: 0, totalCompleted: 0, totalCancelled: 0, weeklyTrend: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchMetrics();
  }, [profile?.id]);

  const fetchMetrics = async () => {
    try {
      const sixWeeksAgo = new Date();
      sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('status, created_at, updated_at, scheduled_pickup_time, delivery_type')
        .eq('assigned_company_id', profile!.id)
        .gte('created_at', sixWeeksAgo.toISOString())
        .in('status', ['completed', 'cancelled']);

      if (error) throw error;

      const completed = (jobs || []).filter(j => j.status === 'completed');
      const cancelled = (jobs || []).filter(j => j.status === 'cancelled');

      let onTimeCount = 0;
      let totalHours = 0;

      completed.forEach(job => {
        const created = new Date(job.created_at);
        const updated = new Date(job.updated_at || job.created_at);
        const hoursToComplete = (updated.getTime() - created.getTime()) / (1000 * 60 * 60);
        totalHours += hoursToComplete;

        if (job.delivery_type === 'scheduled' && job.scheduled_pickup_time) {
          const scheduledTime = new Date(job.scheduled_pickup_time);
          if (updated <= new Date(scheduledTime.getTime() + 30 * 60000)) {
            onTimeCount++;
          }
        } else {
          if (hoursToComplete <= 4) {
            onTimeCount++;
          }
        }
      });

      const onTimeRate = completed.length > 0 ? (onTimeCount / completed.length) * 100 : 0;
      const avgCompletionHours = completed.length > 0 ? totalHours / completed.length : 0;

      const weeklyTrend: WeekData[] = [];
      for (let i = 5; i >= 0; i--) {
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - (i * 7 + weekStart.getDay()));
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const count = completed.filter(j => {
          const d = new Date(j.updated_at || j.created_at);
          return d >= weekStart && d < weekEnd;
        }).length;

        const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        weeklyTrend.push({ label, count });
      }

      setMetrics({
        onTimeRate,
        avgCompletionHours,
        totalCompleted: completed.length,
        totalCancelled: cancelled.length,
        weeklyTrend
      });
    } catch (err) {
      console.error('Error fetching performance metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  const maxCount = Math.max(...metrics.weeklyTrend.map(w => w.count), 1);

  if (loading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="h-4 bg-gray-200 rounded w-40" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-gray-100 rounded-xl" />
          ))}
        </div>
        <div className="h-32 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="w-5 h-5 text-moveme-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">Performance (6 Weeks)</h3>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-5">
        <div className="bg-gradient-to-br from-success-50 to-success-100/50 rounded-xl p-3 text-center">
          <Target className="w-4 h-4 text-success-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-success-700">{metrics.onTimeRate.toFixed(0)}%</p>
          <p className="text-[10px] text-success-600/70">On-Time Rate</p>
        </div>
        <div className="bg-gradient-to-br from-moveme-blue-50 to-moveme-blue-100/50 rounded-xl p-3 text-center">
          <Clock className="w-4 h-4 text-moveme-blue-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-moveme-blue-700">
            {metrics.avgCompletionHours < 1
              ? `${(metrics.avgCompletionHours * 60).toFixed(0)}m`
              : `${metrics.avgCompletionHours.toFixed(1)}h`
            }
          </p>
          <p className="text-[10px] text-moveme-blue-600/70">Avg Time</p>
        </div>
        <div className="bg-gradient-to-br from-moveme-teal-50 to-moveme-teal-100/50 rounded-xl p-3 text-center">
          <CheckCircle className="w-4 h-4 text-moveme-teal-600 mx-auto mb-1" />
          <p className="text-lg font-bold text-moveme-teal-700">{metrics.totalCompleted}</p>
          <p className="text-[10px] text-moveme-teal-600/70">Completed</p>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-1.5 mb-3">
          <TrendingUp className="w-3.5 h-3.5 text-gray-500" />
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Weekly Job Volume</p>
        </div>

        <div className="flex items-end justify-between gap-1.5 h-24">
          {metrics.weeklyTrend.map((week, i) => {
            const height = maxCount > 0 ? (week.count / maxCount) * 100 : 0;
            const isLast = i === metrics.weeklyTrend.length - 1;
            return (
              <div key={week.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] font-medium text-gray-500">{week.count}</span>
                <div className="w-full flex justify-center" style={{ height: '72px' }}>
                  <div
                    className={`w-full max-w-[28px] rounded-t-md transition-all duration-500 ${
                      isLast
                        ? 'bg-gradient-to-t from-moveme-blue-600 to-moveme-blue-400'
                        : 'bg-gradient-to-t from-gray-200 to-gray-100'
                    }`}
                    style={{ height: `${Math.max(height, 4)}%` }}
                  />
                </div>
                <span className="text-[9px] text-gray-400 whitespace-nowrap">{week.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {metrics.totalCancelled > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-500">Cancelled jobs</span>
          <span className="text-xs font-semibold text-error-600">{metrics.totalCancelled}</span>
        </div>
      )}
    </div>
  );
}
