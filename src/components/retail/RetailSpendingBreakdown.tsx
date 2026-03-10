import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, Package, BarChart3, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fetchPlatformFeePercentage, VAT_PERCENTAGE } from '../../lib/pricing';

interface SpendingData {
  thisMonth: number;
  thisMonthCount: number;
  lastMonth: number;
  lastMonthCount: number;
}

interface Props {
  userId: string;
}

export function RetailSpendingBreakdown({ userId }: Props) {
  const [data, setData] = useState<SpendingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSpending();
  }, [userId]);

  const fetchSpending = async () => {
    try {
      const feeRate = await fetchPlatformFeePercentage();
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

      const [thisMonthRes, lastMonthRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('customer_offer_ttd, customer_total')
          .eq('customer_user_id', userId)
          .eq('status', 'completed')
          .gte('updated_at', thisMonthStart),
        supabase
          .from('jobs')
          .select('customer_offer_ttd, customer_total')
          .eq('customer_user_id', userId)
          .eq('status', 'completed')
          .gte('updated_at', lastMonthStart)
          .lte('updated_at', lastMonthEnd),
      ]);

      const thisMonthJobs = thisMonthRes.data || [];
      const lastMonthJobs = lastMonthRes.data || [];

      const getTotal = (j: any) => j.customer_total ?? Math.round((j.customer_offer_ttd || 0) * (1 + feeRate + VAT_PERCENTAGE) * 100) / 100;
      setData({
        thisMonth: thisMonthJobs.reduce((sum, j) => sum + getTotal(j), 0),
        thisMonthCount: thisMonthJobs.length,
        lastMonth: lastMonthJobs.reduce((sum, j) => sum + getTotal(j), 0),
        lastMonthCount: lastMonthJobs.length,
      });
    } catch (error) {
      console.error('Error fetching spending:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data) return null;

  const percentChange = data.lastMonth > 0
    ? Math.round(((data.thisMonth - data.lastMonth) / data.lastMonth) * 100)
    : data.thisMonth > 0 ? 100 : 0;

  const avgCost = data.thisMonthCount > 0
    ? Math.round(data.thisMonth / data.thisMonthCount)
    : 0;

  const TrendIcon = percentChange > 0 ? TrendingUp : percentChange < 0 ? TrendingDown : Minus;
  const trendColor = percentChange > 0
    ? 'text-warning-600'
    : percentChange < 0
      ? 'text-success-600'
      : 'text-gray-500';

  const monthName = new Date().toLocaleString('default', { month: 'long' });

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">{monthName} Spending</h3>
        {percentChange !== 0 && (
          <div className={`flex items-center gap-1 text-[11px] font-semibold ${trendColor}`}>
            <TrendIcon className="w-3 h-3" />
            <span>{Math.abs(percentChange)}% vs last month</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="w-8 h-8 bg-moveme-blue-50 rounded-lg flex items-center justify-center mx-auto mb-1.5">
            <DollarSign className="w-4 h-4 text-moveme-blue-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">${data.thisMonth.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Spent</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="w-8 h-8 bg-success-50 rounded-lg flex items-center justify-center mx-auto mb-1.5">
            <Package className="w-4 h-4 text-success-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">{data.thisMonthCount}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Deliveries</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-3 text-center">
          <div className="w-8 h-8 bg-warning-50 rounded-lg flex items-center justify-center mx-auto mb-1.5">
            <BarChart3 className="w-4 h-4 text-warning-600" />
          </div>
          <p className="text-lg font-bold text-gray-900">${avgCost.toLocaleString()}</p>
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Avg Cost</p>
        </div>
      </div>
    </div>
  );
}
