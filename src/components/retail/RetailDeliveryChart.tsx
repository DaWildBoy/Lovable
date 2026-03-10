import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface WeekData {
  label: string;
  count: number;
}

interface Props {
  userId: string;
}

export function RetailDeliveryChart({ userId }: Props) {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [totalLastMonth, setTotalLastMonth] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [userId]);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

      const [thisMonthRes, lastMonthRes, allThisMonthRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('updated_at')
          .eq('customer_user_id', userId)
          .eq('status', 'completed')
          .gte('updated_at', monthStart.toISOString())
          .lte('updated_at', monthEnd.toISOString()),
        supabase
          .from('jobs')
          .select('id')
          .eq('customer_user_id', userId)
          .eq('status', 'completed')
          .gte('updated_at', lastMonthStart.toISOString())
          .lte('updated_at', lastMonthEnd.toISOString()),
        supabase
          .from('jobs')
          .select('status')
          .eq('customer_user_id', userId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
      ]);

      const completedJobs = thisMonthRes.data || [];
      const lastMonthJobs = lastMonthRes.data || [];
      const allJobs = allThisMonthRes.data || [];

      setTotalThisMonth(completedJobs.length);
      setTotalLastMonth(lastMonthJobs.length);

      const completedCount = allJobs.filter(j => j.status === 'completed').length;
      const cancelledCount = allJobs.filter(j => j.status === 'cancelled').length;
      const totalFinished = completedCount + cancelledCount;
      setSuccessRate(totalFinished > 0 ? Math.round((completedCount / totalFinished) * 100) : 100);

      const weekBuckets: WeekData[] = [];
      let weekStart = new Date(monthStart);
      let weekNum = 1;

      while (weekStart <= monthEnd) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());

        const count = completedJobs.filter(j => {
          if (!j.updated_at) return false;
          const d = new Date(j.updated_at);
          return d >= weekStart && d <= weekEnd;
        }).length;

        weekBuckets.push({ label: `W${weekNum}`, count });
        weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() + 1);
        weekNum++;
      }

      setWeeks(weekBuckets);
    } catch (error) {
      console.error('Error fetching delivery chart:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return null;

  const maxCount = Math.max(...weeks.map(w => w.count), 1);
  const monthName = new Date().toLocaleString('default', { month: 'long' });
  const percentChange = totalLastMonth > 0
    ? Math.round(((totalThisMonth - totalLastMonth) / totalLastMonth) * 100)
    : totalThisMonth > 0 ? 100 : 0;

  const TrendIcon = percentChange > 0 ? TrendingUp : percentChange < 0 ? TrendingDown : Minus;
  const trendColor = percentChange > 0 ? 'text-success-600' : percentChange < 0 ? 'text-error-600' : 'text-gray-400';

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-moveme-blue-600" />
          <h3 className="text-sm font-bold text-gray-900">{monthName} Deliveries</h3>
        </div>
        {percentChange !== 0 && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(percentChange)}%</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mb-4 text-xs text-gray-500">
        <span>{totalThisMonth} completed</span>
        <span className="text-gray-200">|</span>
        <span>{successRate}% success rate</span>
      </div>

      {weeks.length > 0 ? (
        <div className="flex items-end gap-2 h-20">
          {weeks.map((week, i) => {
            const heightPercent = maxCount > 0 ? (week.count / maxCount) * 100 : 0;
            const isCurrentWeek = i === weeks.length - 1;

            return (
              <div key={week.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-gray-700">{week.count}</span>
                <div className="w-full relative" style={{ height: '48px' }}>
                  <div
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[36px] rounded-md transition-all ${
                      isCurrentWeek
                        ? 'bg-moveme-blue-500'
                        : 'bg-moveme-blue-100 hover:bg-moveme-blue-200'
                    }`}
                    style={{ height: `${Math.max(heightPercent, 10)}%` }}
                  />
                </div>
                <span className={`text-[10px] font-medium ${
                  isCurrentWeek ? 'text-moveme-blue-600' : 'text-gray-400'
                }`}>
                  {week.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-xs text-gray-400">
          No completed deliveries this month
        </div>
      )}
    </div>
  );
}
