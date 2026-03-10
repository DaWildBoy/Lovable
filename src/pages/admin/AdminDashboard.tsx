import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { canAccessJobs, canAccessCompanies, canAccessMessages, canAccessRevenue } from '../../lib/adminAuth';
import { timeAgo } from './adminUtils';
import {
  Briefcase, TruckIcon, CheckCircle2, Users, DollarSign, Radio,
  Bell, ClipboardList, Building2, MessageSquare, BarChart3, ArrowRight, Loader2,
} from 'lucide-react';

interface AdminDashboardProps {
  onNavigate: (path: string) => void;
}

interface KPIs {
  totalJobs: number;
  activeJobs: number;
  completedJobs: number;
  totalUsers: number;
  totalRevenue: number;
  activeCouriers: number;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string | null;
  read: boolean | null;
}

const formatCurrency = (amount: number) =>
  `TT$${amount.toLocaleString('en-TT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AdminDashboard({ onNavigate }: AdminDashboardProps) {
  const { profile } = useAuth();
  const [kpis, setKpis] = useState<KPIs>({ totalJobs: 0, activeJobs: 0, completedJobs: 0, totalUsers: 0, totalRevenue: 0, activeCouriers: 0 });
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [
          { count: totalJobs },
          { count: activeJobs },
          { count: completedJobs },
          { count: totalUsers },
          { data: revenueData },
          { count: activeCouriers },
          { data: notifData },
        ] = await Promise.all([
          supabase.from('jobs').select('*', { count: 'exact', head: true }),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).in('status', ['open', 'assigned', 'picked_up', 'in_transit']),
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('jobs').select('platform_fee').eq('status', 'completed').not('platform_fee', 'is', null),
          supabase.from('couriers').select('*', { count: 'exact', head: true }).eq('is_online', true),
          supabase.from('notifications').select('id, type, title, message, created_at, read').order('created_at', { ascending: false }).limit(10),
        ]);

        const revenue = (revenueData || []).reduce((sum: number, j: { platform_fee: number | null }) => sum + (j.platform_fee || 0), 0);
        setKpis({ totalJobs: totalJobs || 0, activeJobs: activeJobs || 0, completedJobs: completedJobs || 0, totalUsers: totalUsers || 0, totalRevenue: revenue, activeCouriers: activeCouriers || 0 });
        setNotifications((notifData || []) as Notification[]);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally { setLoading(false); }
    };
    fetchData();

    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => { fetchData(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => { fetchData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="w-8 h-8 text-moveme-blue-600 animate-spin" /></div>;
  }

  const kpiCards = [
    { label: 'Total Jobs', value: kpis.totalJobs.toLocaleString(), icon: Briefcase, bg: 'bg-moveme-blue-50', color: 'text-moveme-blue-600' },
    { label: 'Active Jobs', value: kpis.activeJobs.toLocaleString(), icon: TruckIcon, bg: 'bg-warning-50', color: 'text-warning-600' },
    { label: 'Completed', value: kpis.completedJobs.toLocaleString(), icon: CheckCircle2, bg: 'bg-success-50', color: 'text-success-600' },
    { label: 'Total Users', value: kpis.totalUsers.toLocaleString(), icon: Users, bg: 'bg-moveme-teal-50', color: 'text-moveme-teal-600' },
    { label: 'Platform Revenue', value: formatCurrency(kpis.totalRevenue), icon: DollarSign, bg: 'bg-success-50', color: 'text-success-600' },
    { label: 'Couriers Online', value: kpis.activeCouriers.toLocaleString(), icon: Radio, bg: 'bg-moveme-blue-50', color: 'text-moveme-blue-700' },
  ];

  const allQuickActions = [
    { label: 'Jobs', path: '/admin/jobs', icon: ClipboardList, bg: 'bg-moveme-blue-50', color: 'text-moveme-blue-600', check: canAccessJobs },
    { label: 'Users', path: '/admin/users', icon: Users, bg: 'bg-moveme-teal-50', color: 'text-moveme-teal-600', check: () => true },
    { label: 'Companies', path: '/admin/companies', icon: Building2, bg: 'bg-warning-50', color: 'text-warning-600', check: canAccessCompanies },
    { label: 'Messages', path: '/admin/messages', icon: MessageSquare, bg: 'bg-moveme-blue-50', color: 'text-moveme-blue-700', check: canAccessMessages },
    { label: 'Revenue', path: '/admin/revenue', icon: BarChart3, bg: 'bg-success-50', color: 'text-success-600', check: canAccessRevenue },
  ];

  const quickActions = allQuickActions.filter((a) => a.check(profile));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">MoveMe TT platform overview</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-card transition-shadow">
            <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center mb-3`}>
              <card.icon className={`w-5 h-5 ${card.color}`} />
            </div>
            <p className="text-xs font-medium text-gray-500 mb-1">{card.label}</p>
            <p className="text-xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-moveme-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Recent Activity</h2>
            </div>
            <span className="text-xs text-gray-400">Last 10 notifications</span>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">No recent activity</p>
          ) : (
            <div className="space-y-1">
              {notifications.map((n) => (
                <div key={n.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors ${n.read ? 'bg-white' : 'bg-moveme-blue-50/40'}`}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-gray-300' : 'bg-moveme-blue-600'}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                    <p className="text-xs text-gray-500 truncate">{n.message}</p>
                  </div>
                  <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0">{timeAgo(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button key={action.path} onClick={() => onNavigate(action.path)} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-50 hover:shadow-card transition-all group">
                <div className={`w-9 h-9 ${action.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                  <action.icon className={`w-4 h-4 ${action.color}`} />
                </div>
                <span className="text-sm font-medium text-gray-700 flex-1 text-left">{action.label}</span>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-moveme-blue-600 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
