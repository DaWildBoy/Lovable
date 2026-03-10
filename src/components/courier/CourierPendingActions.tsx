import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { MessageSquare, FileCheck, ArrowRightLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface Props {
  userId: string;
  courierId: string;
  onNavigate: (path: string) => void;
}

interface PendingCounts {
  counterOffers: number;
  unreadMessages: number;
  pendingProofs: number;
}

export function CourierPendingActions({ userId, courierId, onNavigate }: Props) {
  const [counts, setCounts] = useState<PendingCounts>({
    counterOffers: 0,
    unreadMessages: 0,
    pendingProofs: 0,
  });

  useEffect(() => {
    fetchCounts();
  }, [userId, courierId]);

  const fetchCounts = async () => {
    try {
      const [counterRes, notifRes, podRes] = await Promise.all([
        supabase
          .from('counter_offers')
          .select('id', { count: 'exact', head: true })
          .eq('courier_id', courierId)
          .eq('status', 'pending')
          .neq('offered_by_role', 'courier'),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('read', false)
          .eq('type', 'new_message'),
        supabase
          .from('proof_of_delivery')
          .select('id, job_id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .eq('completed_by_user_id', userId),
      ]);

      const pendingPodJobs = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_courier_id', courierId)
        .eq('status', 'delivered');

      setCounts({
        counterOffers: counterRes.count || 0,
        unreadMessages: notifRes.count || 0,
        pendingProofs: pendingPodJobs.count || 0,
      });
    } catch (err) {
      console.error('Error fetching pending counts:', err);
    }
  };

  const total = counts.counterOffers + counts.unreadMessages + counts.pendingProofs;
  if (total === 0) return null;

  const actions = [
    {
      label: 'Counter Offers',
      count: counts.counterOffers,
      icon: ArrowRightLeft,
      gradient: 'from-amber-400 to-orange-500',
      lightBg: 'bg-amber-50',
      textColor: 'text-amber-700',
      path: '/courier/jobs?tab=active',
    },
    {
      label: 'Unread Messages',
      count: counts.unreadMessages,
      icon: MessageSquare,
      gradient: 'from-blue-400 to-blue-600',
      lightBg: 'bg-blue-50',
      textColor: 'text-blue-700',
      path: '/courier/messages',
    },
    {
      label: 'Proof of Delivery',
      count: counts.pendingProofs,
      icon: FileCheck,
      gradient: 'from-red-400 to-red-600',
      lightBg: 'bg-red-50',
      textColor: 'text-red-700',
      path: '/courier/jobs?tab=active',
    },
  ].filter(a => a.count > 0);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-bold text-gray-900">Needs Attention</h3>
        </div>
        <span className="text-[11px] font-bold text-white bg-red-500 rounded-full min-w-[22px] h-[22px] flex items-center justify-center px-1.5">
          {total}
        </span>
      </div>
      <div className="px-3 pb-3">
        {actions.map(action => (
          <button
            key={action.label}
            onClick={() => onNavigate(action.path)}
            className="flex items-center gap-3 w-full p-3 rounded-xl hover:bg-gray-50 transition-all duration-150 active:scale-[0.98] group"
          >
            <div className={`w-9 h-9 bg-gradient-to-br ${action.gradient} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
              <action.icon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900">{action.label}</p>
            </div>
            <span className={`text-sm font-bold ${action.textColor} tabular-nums`}>{action.count}</span>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}
