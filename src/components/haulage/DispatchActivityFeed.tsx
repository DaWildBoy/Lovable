import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Activity,
  Truck,
  CheckCircle,
  Package,
  UserCheck,
  Clock,
  AlertTriangle,
  XCircle,
  ArrowRight
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string;
  read: boolean;
}

interface DispatchActivityFeedProps {
  onNavigate: (path: string) => void;
}

const iconMap: Record<string, { icon: typeof Activity; color: string; bg: string }> = {
  job_completed: { icon: CheckCircle, color: 'text-success-600', bg: 'bg-success-100' },
  job_assigned: { icon: UserCheck, color: 'text-moveme-blue-600', bg: 'bg-moveme-blue-100' },
  job_accepted: { icon: Package, color: 'text-moveme-teal-600', bg: 'bg-moveme-teal-100' },
  new_job_available: { icon: Truck, color: 'text-warning-600', bg: 'bg-warning-100' },
  job_cancelled: { icon: XCircle, color: 'text-error-600', bg: 'bg-error-100' },
  counter_offer: { icon: Clock, color: 'text-warning-600', bg: 'bg-warning-100' },
  delivery_issue: { icon: AlertTriangle, color: 'text-error-600', bg: 'bg-error-100' },
};

function getTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  return `${diffDays}d ago`;
}

export function DispatchActivityFeed({ onNavigate }: DispatchActivityFeedProps) {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchActivities();

    const channel = supabase
      .channel('dispatch-activity-live')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          fetchActivities();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, message, created_at, read')
        .eq('user_id', profile!.id)
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      setActivities(data || []);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoading(false);
    }
  };

  const defaultIcon = { icon: Activity, color: 'text-gray-600', bg: 'bg-gray-100' };

  if (loading) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 bg-gray-200 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-5 h-5 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <p className="text-sm text-gray-400 text-center py-4">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <button
          onClick={() => onNavigate('/business/notifications')}
          className="text-xs text-moveme-blue-600 hover:text-moveme-blue-700 font-medium flex items-center gap-1"
        >
          View All
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="space-y-1">
        {activities.map((activity, idx) => {
          const config = iconMap[activity.type] || defaultIcon;
          const Icon = config.icon;
          return (
            <div
              key={activity.id}
              className={`flex items-start gap-3 p-2.5 rounded-xl transition-colors hover:bg-gray-50 ${
                !activity.read ? 'bg-moveme-blue-50/40' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                <Icon className={`w-4 h-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${!activity.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
                  {activity.title}
                </p>
                <p className="text-xs text-gray-500 truncate mt-0.5">{activity.message}</p>
              </div>
              <span className="text-[10px] text-gray-400 flex-shrink-0 mt-0.5">
                {getTimeAgo(activity.created_at)}
              </span>
              {idx < activities.length - 1 && <div className="sr-only" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
