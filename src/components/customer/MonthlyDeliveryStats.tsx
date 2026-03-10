import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart3 } from 'lucide-react';

interface WeekData {
  label: string;
  count: number;
}

interface Props {
  userId: string;
}

export function MonthlyDeliveryStats({ userId }: Props) {
  const [weeks, setWeeks] = useState<WeekData[]>([]);
  const [totalThisMonth, setTotalThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, [userId]);

  const fetchStats = async () => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      const { data: jobs } = await supabase
        .from('jobs')
        .select('updated_at')
        .eq('customer_user_id', userId)
        .eq('status', 'completed')
        .gte('updated_at', monthStart.toISOString())
        .lte('updated_at', monthEnd.toISOString());

      if (!jobs || jobs.length === 0) {
        setWeeks([]);
        return;
      }

      setTotalThisMonth(jobs.length);

      const weekBuckets: WeekData[] = [];
      let weekStart = new Date(monthStart);
      let weekNum = 1;

      while (weekStart <= monthEnd) {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd > monthEnd) weekEnd.setTime(monthEnd.getTime());

        const count = jobs.filter(j => {
          if (!j.updated_at) return false;
          const d = new Date(j.updated_at);
          return d >= weekStart && d <= weekEnd;
        }).length;

        weekBuckets.push({
          label: `W${weekNum}`,
          count,
        });

        weekStart = new Date(weekEnd);
        weekStart.setDate(weekStart.getDate() + 1);
        weekNum++;
      }

      setWeeks(weekBuckets);
    } catch (error) {
      console.error('Error fetching delivery stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || weeks.length === 0) return null;

  const maxCount = Math.max(...weeks.map(w => w.count), 1);
  const monthName = new Date().toLocaleString('default', { month: 'long' });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-moveme-blue-600" />
          <h3 className="text-sm font-bold text-gray-900">{monthName} Activity</h3>
        </div>
        <span className="text-xs text-gray-500 font-medium">{totalThisMonth} deliveries</span>
      </div>

      <div className="flex items-end gap-2 h-24">
        {weeks.map((week, i) => {
          const heightPercent = maxCount > 0 ? (week.count / maxCount) * 100 : 0;
          const isCurrentWeek = i === weeks.length - 1;

          return (
            <div key={week.label} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold text-gray-900">{week.count}</span>
              <div className="w-full relative" style={{ height: '64px' }}>
                <div
                  className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[40px] rounded-lg transition-all ${
                    isCurrentWeek
                      ? 'bg-moveme-blue-500'
                      : 'bg-moveme-blue-100'
                  }`}
                  style={{ height: `${Math.max(heightPercent, 8)}%` }}
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
    </div>
  );
}
