import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, TrendingUp, ChevronRight } from 'lucide-react';
import { fetchPlatformFeePercentage } from '../../lib/pricing';

interface Props {
  userId: string;
  courierId: string;
  onNavigate: (path: string) => void;
}

export function CourierTodaysEarnings({ userId, courierId, onNavigate }: Props) {
  const [todayEarnings, setTodayEarnings] = useState(0);
  const [todayDeliveries, setTodayDeliveries] = useState(0);
  const [weeklyAvg, setWeeklyAvg] = useState(0);

  useEffect(() => {
    fetchEarnings();
  }, [userId, courierId]);

  const fetchEarnings = async () => {
    try {
      const feeRate = await fetchPlatformFeePercentage();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      const [todayRes, weekRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('customer_offer_ttd, driver_net_earnings')
          .eq('assigned_courier_id', courierId)
          .eq('status', 'completed')
          .gte('updated_at', todayStart.toISOString()),
        supabase
          .from('jobs')
          .select('customer_offer_ttd, driver_net_earnings, updated_at')
          .eq('assigned_courier_id', courierId)
          .eq('status', 'completed')
          .gte('updated_at', weekStart.toISOString()),
      ]);

      const todayJobs = todayRes.data || [];
      const weekJobs = weekRes.data || [];

      const getNet = (j: any) => j.driver_net_earnings ?? Math.round((j.customer_offer_ttd || 0) * (1 - feeRate) * 100) / 100;
      const todayTotal = todayJobs.reduce((sum, j) => sum + getNet(j), 0);
      setTodayEarnings(todayTotal);
      setTodayDeliveries(todayJobs.length);

      const daysSoFar = Math.max(1, new Date().getDay() || 7);
      const weekTotal = weekJobs.reduce((sum, j) => sum + getNet(j), 0);
      setWeeklyAvg(Math.round(weekTotal / daysSoFar));
    } catch (err) {
      console.error('Error fetching today earnings:', err);
    }
  };

  const dailyGoal = Math.max(weeklyAvg * 1.2, 200);
  const progressPercent = Math.min((todayEarnings / dailyGoal) * 100, 100);

  return (
    <button
      onClick={() => onNavigate('/courier/jobs?tab=completed')}
      className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 w-full text-left hover:shadow-elevated transition-all duration-200 active:scale-[0.98] group"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-green-500 rounded-xl flex items-center justify-center shadow-sm">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-sm font-bold text-gray-900">Today's Earnings</span>
            <div className="flex items-center gap-1 mt-0.5">
              <TrendingUp className="w-3 h-3 text-gray-400" />
              <span className="text-[11px] text-gray-500">{todayDeliveries} deliver{todayDeliveries !== 1 ? 'ies' : 'y'}</span>
            </div>
          </div>
        </div>
        <div className="text-right flex items-center gap-2">
          <div>
            <p className="text-xl font-bold text-gray-900 tabular-nums">TTD ${todayEarnings.toFixed(0)}</p>
            <p className="text-[10px] text-gray-400 font-medium">avg ${weeklyAvg}/day</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
        </div>
      </div>

      <div className="relative w-full bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-400 to-green-500 rounded-full transition-all duration-700 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </button>
  );
}
