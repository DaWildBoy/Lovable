import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Clock, DollarSign, Calendar } from 'lucide-react';

interface Props {
  userId: string;
  memberSince: string | null;
}

interface ActivityData {
  totalDeliveries: number;
  activeJobs: number;
  totalSpent: number;
}

export function CustomerProfileActivitySummary({ userId, memberSince }: Props) {
  const [data, setData] = useState<ActivityData>({ totalDeliveries: 0, activeJobs: 0, totalSpent: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivity();
  }, [userId]);

  const fetchActivity = async () => {
    try {
      const [completedRes, activeRes, spentRes] = await Promise.all([
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('customer_user_id', userId)
          .in('status', ['completed', 'delivered']),
        supabase
          .from('jobs')
          .select('id', { count: 'exact', head: true })
          .eq('customer_user_id', userId)
          .in('status', ['open', 'bidding', 'assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'in_progress']),
        supabase
          .from('jobs')
          .select('customer_total')
          .eq('customer_user_id', userId)
          .in('status', ['completed', 'delivered']),
      ]);

      const totalSpent = (spentRes.data || []).reduce((sum, j) => sum + (Number(j.customer_total) || 0), 0);

      setData({
        totalDeliveries: completedRes.count || 0,
        activeJobs: activeRes.count || 0,
        totalSpent,
      });
    } catch (err) {
      console.error('Error fetching activity:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatMemberSince = (date: string | null) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const stats = [
    {
      icon: Package,
      label: 'Deliveries',
      value: data.totalDeliveries.toString(),
      color: 'bg-blue-50 text-blue-600',
    },
    {
      icon: Clock,
      label: 'Active',
      value: data.activeJobs.toString(),
      color: 'bg-amber-50 text-amber-600',
    },
    {
      icon: DollarSign,
      label: 'Total Spent',
      value: `$${data.totalSpent.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      color: 'bg-emerald-50 text-emerald-600',
    },
    {
      icon: Calendar,
      label: 'Member Since',
      value: formatMemberSince(memberSince),
      color: 'bg-sky-50 text-sky-600',
    },
  ];

  if (loading) {
    return (
      <div className="px-4">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card p-4 animate-pulse">
                <div className="h-10 w-10 bg-gray-100 rounded-xl mb-3" />
                <div className="h-4 bg-gray-100 rounded w-12 mb-1" />
                <div className="h-3 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.label} className="card p-4 hover:shadow-elevated transition-all duration-200">
                <div className={`w-10 h-10 rounded-xl ${stat.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-lg font-bold text-gray-900 leading-none">{stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
