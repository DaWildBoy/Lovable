import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { BarChart3 } from 'lucide-react';
import { fetchPlatformFeePercentage } from '../../lib/pricing';

interface Props {
  userId: string;
  courierId: string;
}

interface DayEarning {
  label: string;
  amount: number;
  isToday: boolean;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function CourierWeeklyChart({ userId, courierId }: Props) {
  const [days, setDays] = useState<DayEarning[]>([]);
  const [weekTotal, setWeekTotal] = useState(0);

  useEffect(() => {
    fetchWeeklyData();
  }, [userId, courierId]);

  const fetchWeeklyData = async () => {
    try {
      const feeRate = await fetchPlatformFeePercentage();
      const now = new Date();
      const dayOfWeek = now.getDay();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - dayOfWeek);
      weekStart.setHours(0, 0, 0, 0);

      const { data: jobs } = await supabase
        .from('jobs')
        .select('customer_offer_ttd, driver_net_earnings, updated_at')
        .eq('assigned_courier_id', courierId)
        .eq('status', 'completed')
        .gte('updated_at', weekStart.toISOString());

      const earningsByDay: number[] = Array(7).fill(0);

      (jobs || []).forEach((job: any) => {
        const jobDate = new Date(job.updated_at || '');
        const jobDay = jobDate.getDay();
        const net = job.driver_net_earnings ?? Math.round((job.customer_offer_ttd || 0) * (1 - feeRate) * 100) / 100;
        earningsByDay[jobDay] += net;
      });

      const today = now.getDay();
      const result: DayEarning[] = DAY_LABELS.map((label, i) => ({
        label,
        amount: earningsByDay[i],
        isToday: i === today,
      }));

      setDays(result);
      setWeekTotal(earningsByDay.reduce((s, v) => s + v, 0));
    } catch (err) {
      console.error('Error fetching weekly data:', err);
    }
  };

  const maxAmount = Math.max(...days.map(d => d.amount), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-blue-600" />
          </div>
          <span className="text-sm font-bold text-gray-900">This Week</span>
        </div>
        <span className="text-base font-bold text-moveme-blue-600 tabular-nums">TTD ${weekTotal.toFixed(0)}</span>
      </div>

      <div className="flex items-end justify-between gap-2 h-28">
        {days.map((day) => {
          const height = day.amount > 0 ? Math.max((day.amount / maxAmount) * 100, 10) : 5;
          return (
            <div key={day.label} className="flex flex-col items-center flex-1 gap-1.5">
              {day.amount > 0 && (
                <span className="text-[9px] font-bold text-gray-500 tabular-nums">${day.amount.toFixed(0)}</span>
              )}
              <div className="w-full relative">
                <div
                  className={`w-full rounded-lg transition-all duration-500 ease-out ${
                    day.isToday
                      ? 'bg-gradient-to-t from-moveme-blue-600 to-blue-400 shadow-sm shadow-blue-200'
                      : day.amount > 0
                      ? 'bg-blue-100'
                      : 'bg-gray-100'
                  }`}
                  style={{ height: `${height}%`, minHeight: day.amount > 0 ? '12px' : '4px' }}
                />
              </div>
              <span className={`text-[10px] font-semibold ${
                day.isToday ? 'text-moveme-blue-600' : 'text-gray-400'
              }`}>
                {day.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
