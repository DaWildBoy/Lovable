import { useState, useEffect } from 'react';
import { TrendingUp, Package, Clock, CheckCircle, DollarSign, XCircle } from 'lucide-react';
import { formatMinutesToHoursMinutes } from '../../lib/timeUtils';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface AnalyticsData {
  totalJobs: number;
  completedJobs: number;
  averageDeliveryTimeMinutes: number;
  onTimePercentage: number;
  cancellationsCount: number;
  totalSpent: number;
  averageCostPerDelivery: number;
}

export function RetailAnalytics() {
  const { profile } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalJobs: 0,
    completedJobs: 0,
    averageDeliveryTimeMinutes: 0,
    onTimePercentage: 0,
    cancellationsCount: 0,
    totalSpent: 0,
    averageCostPerDelivery: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [profile]);

  const fetchAnalytics = async () => {
    if (!profile) return;

    try {
      const { data: jobs, error } = await supabase
        .from('jobs')
        .select('status, price_ttd, created_at, updated_at, cancelled_at')
        .eq('customer_id', profile.id);

      if (error) throw error;

      const totalJobs = jobs?.length || 0;
      const completedJobs = jobs?.filter(j => j.status === 'completed').length || 0;
      const cancellationsCount = jobs?.filter(j => j.cancelled_at !== null).length || 0;

      const totalSpent = jobs
        ?.filter(j => j.status === 'completed')
        .reduce((sum, j) => sum + (j.price_ttd || 0), 0) || 0;

      const averageCostPerDelivery = completedJobs > 0 ? totalSpent / completedJobs : 0;

      const completedJobsWithTimes = jobs?.filter(j => j.status === 'completed' && j.created_at && j.updated_at) || [];
      const averageDeliveryTimeMinutes = completedJobsWithTimes.length > 0
        ? completedJobsWithTimes.reduce((sum, j) => {
            const start = new Date(j.created_at!).getTime();
            const end = new Date(j.updated_at!).getTime();
            return sum + ((end - start) / 1000 / 60);
          }, 0) / completedJobsWithTimes.length
        : 0;

      const onTimePercentage = completedJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

      setAnalytics({
        totalJobs,
        completedJobs,
        averageDeliveryTimeMinutes: Math.round(averageDeliveryTimeMinutes),
        onTimePercentage: Math.round(onTimePercentage),
        cancellationsCount,
        totalSpent,
        averageCostPerDelivery,
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      label: 'Total Jobs',
      value: analytics.totalJobs,
      icon: Package,
      color: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Completed',
      value: analytics.completedJobs,
      icon: CheckCircle,
      color: 'bg-green-100 text-green-600',
    },
    {
      label: 'Avg. Delivery Time',
      value: formatMinutesToHoursMinutes(analytics.averageDeliveryTimeMinutes),
      icon: Clock,
      color: 'bg-orange-100 text-orange-600',
    },
    {
      label: 'On-Time Rate',
      value: `${analytics.onTimePercentage}%`,
      icon: TrendingUp,
      color: 'bg-teal-100 text-teal-600',
    },
    {
      label: 'Cancellations',
      value: analytics.cancellationsCount,
      icon: XCircle,
      color: 'bg-red-100 text-red-600',
    },
    {
      label: 'Total Spent',
      value: `TTD $${analytics.totalSpent.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Avg. Cost/Delivery',
      value: `TTD $${analytics.averageCostPerDelivery.toFixed(2)}`,
      icon: DollarSign,
      color: 'bg-pink-100 text-pink-600',
    },
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">Loading analytics...</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
          <TrendingUp className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Performance Overview</h2>
          <p className="text-sm text-gray-600">View your delivery performance metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="border border-gray-200 rounded-lg p-4">
              <div className={`w-8 h-8 ${stat.color} rounded-lg flex items-center justify-center mb-2`}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</div>
              <div className="text-xs text-gray-600">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-xs text-blue-700">
          <strong>Note:</strong> These metrics are calculated from your completed deliveries and provide insight into your business performance.
        </p>
      </div>
    </div>
  );
}
