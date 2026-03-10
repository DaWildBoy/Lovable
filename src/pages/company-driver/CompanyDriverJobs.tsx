import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { isMobileDevice } from '../../lib/deviceDetection';
import {
  Clock,
  MapPin,
  Package,
  Loader2,
  CheckCircle,
  Truck,
  Navigation,
  Phone,
  MessageSquare,
  ChevronRight,
  Calendar,
  RefreshCw,
  ClipboardCheck,
} from 'lucide-react';
import { Database } from '../../lib/database.types';
import { NotificationToast } from '../../components/NotificationToast';

type Job = Database['public']['Tables']['jobs']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface JobWithCustomer extends Job {
  customer_profile?: Profile;
}

interface CompanyDriverJobsProps {
  onNavigate: (path: string) => void;
}

type TabType = 'assigned' | 'active' | 'completed';

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

const STATUS_LABELS: Record<string, string> = {
  assigned: 'Awaiting Acceptance',
  on_way_to_pickup: 'Heading to Pickup',
  cargo_collected: 'Cargo Collected',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  returning: 'Returning',
  completed: 'Completed',
};

const STATUS_COLORS: Record<string, string> = {
  assigned: 'bg-amber-100 text-amber-700',
  on_way_to_pickup: 'bg-blue-100 text-blue-700',
  cargo_collected: 'bg-cyan-100 text-cyan-700',
  in_transit: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  returning: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
};

export function CompanyDriverJobs({ onNavigate }: CompanyDriverJobsProps) {
  const { user } = useAuth();

  const getInitialTab = (): TabType => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'assigned' || tab === 'active' || tab === 'completed') return tab;
    return 'assigned';
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab);
  const [courierId, setCourierId] = useState<string | null>(null);
  const [assignedJobs, setAssignedJobs] = useState<JobWithCustomer[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobWithCustomer[]>([]);
  const [completedJobs, setCompletedJobs] = useState<JobWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [acceptingJobId, setAcceptingJobId] = useState<string | null>(null);

  useEffect(() => {
    initCourierAndFetch();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'assigned' || tab === 'active' || tab === 'completed') {
      setActiveTab(tab);
    }
  }, []);

  const addNotification = (message: string, type: 'success' | 'info' | 'warning') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 4000);
  };

  const initCourierAndFetch = async () => {
    if (!user) return;
    try {
      const { data: courierData } = await supabase
        .from('couriers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (courierData) {
        setCourierId(courierData.id);
        await fetchJobsWithId(courierData.id);
      }
    } catch (error) {
      console.error('Error fetching courier:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchJobs = async (isRefresh = false) => {
    if (!courierId) return;
    if (isRefresh) setRefreshing(true);
    await fetchJobsWithId(courierId, isRefresh);
  };

  const fetchJobsWithId = async (cId: string, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const { data: assigned } = await supabase
        .from('jobs')
        .select('*, customer_profile:profiles!jobs_customer_user_id_fkey(*)')
        .eq('assigned_courier_id', cId)
        .eq('status', 'assigned')
        .order('created_at', { ascending: false });

      setAssignedJobs(assigned || []);

      const { data: active } = await supabase
        .from('jobs')
        .select('*, customer_profile:profiles!jobs_customer_user_id_fkey(*)')
        .eq('assigned_courier_id', cId)
        .in('status', ['on_way_to_pickup', 'cargo_collected', 'in_transit', 'delivered', 'returning'])
        .order('updated_at', { ascending: false });

      setActiveJobs(active || []);

      const { data: completed } = await supabase
        .from('jobs')
        .select('*, customer_profile:profiles!jobs_customer_user_id_fkey(*)')
        .eq('assigned_courier_id', cId)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(50);

      setCompletedJobs(completed || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const acceptAssignment = async (jobId: string) => {
    if (!isMobileDevice()) {
      addNotification('You must use a mobile device to accept assignments. GPS tracking requires mobile access.', 'warning');
      return;
    }
    if (!user || !courierId) return;
    setAcceptingJobId(jobId);

    try {
      const { data: currentJob } = await supabase
        .from('jobs')
        .select('status, assigned_courier_id')
        .eq('id', jobId)
        .maybeSingle();

      if (!currentJob) {
        addNotification('Job not found.', 'warning');
        return;
      }

      if (currentJob.status !== 'assigned' || currentJob.assigned_courier_id !== courierId) {
        addNotification('This job is no longer assigned to you.', 'warning');
        return;
      }

      const { error } = await supabase
        .from('jobs')
        .update({
          status: 'on_way_to_pickup',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)
        .eq('assigned_courier_id', courierId);

      if (error) throw error;

      addNotification('Assignment accepted! Head to the pickup location.', 'success');
      setActiveTab('active');
      await fetchJobs();
    } catch (error) {
      console.error('Error accepting assignment:', error);
      addNotification('Failed to accept assignment. Please try again.', 'warning');
    } finally {
      setAcceptingJobId(null);
    }
  };

  const getCustomerName = (job: JobWithCustomer) => {
    if (job.customer_profile) {
      return `${job.customer_profile.first_name || ''} ${job.customer_profile.last_name || ''}`.trim() || 'Customer';
    }
    return 'Customer';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-TT', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const currentJobs = activeTab === 'assigned' ? assignedJobs : activeTab === 'active' ? activeJobs : completedJobs;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="gradient-header px-4 pt-8 pb-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm font-medium mb-1">My Assignments</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Jobs</h1>
          </div>
          <button
            onClick={() => fetchJobs(true)}
            disabled={refreshing}
            className="p-2.5 bg-white/15 rounded-xl hover:bg-white/25 transition-colors border border-white/10"
          >
            <RefreshCw className={`w-5 h-5 text-white ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-3">
        <div className="flex gap-2 mb-4 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100">
          <button
            onClick={() => setActiveTab('assigned')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'assigned'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            Assigned
            {assignedJobs.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'assigned' ? 'bg-white/25 text-white' : 'bg-amber-100 text-amber-700'
              }`}>
                {assignedJobs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Truck className="w-4 h-4" />
            Active
            {activeJobs.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'active' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
              }`}>
                {activeJobs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'completed'
                ? 'bg-green-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <CheckCircle className="w-4 h-4" />
            Done
            {completedJobs.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'completed' ? 'bg-white/25 text-white' : 'bg-green-100 text-green-700'
              }`}>
                {completedJobs.length}
              </span>
            )}
          </button>
        </div>

        {!isMobileDevice() && (
          <div className="mb-4 bg-red-50 border-2 border-red-300 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 rounded-lg flex-shrink-0">
                <Phone className="w-5 h-5 text-red-700" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-red-900">Mobile Device Required</h3>
                <p className="text-xs text-red-700 mt-1 leading-relaxed">
                  You must use a mobile device to accept assignments and update delivery status.
                  GPS tracking and real-time updates require mobile access. Please switch to your phone.
                </p>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : currentJobs.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">
              {activeTab === 'assigned' && 'No Pending Assignments'}
              {activeTab === 'active' && 'No Active Deliveries'}
              {activeTab === 'completed' && 'No Completed Deliveries'}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
              {activeTab === 'assigned' && 'Your company will assign jobs here when they need you.'}
              {activeTab === 'active' && 'Accept an assignment to start a delivery.'}
              {activeTab === 'completed' && 'Completed deliveries will appear here.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentJobs.map(job => (
              <div
                key={job.id}
                className={`card overflow-hidden ${
                  activeTab === 'assigned' ? 'border-l-4 border-l-amber-400' :
                  activeTab === 'active' ? 'border-l-4 border-l-blue-500' :
                  'border-l-4 border-l-green-400'
                }`}
              >
                <div className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        activeTab === 'assigned' ? 'bg-amber-100' :
                        activeTab === 'active' ? 'bg-blue-100' : 'bg-green-100'
                      }`}>
                        {activeTab === 'assigned' ? <ClipboardCheck className="w-4.5 h-4.5 text-amber-600" /> :
                         activeTab === 'active' ? <Truck className="w-4.5 h-4.5 text-blue-600" /> :
                         <CheckCircle className="w-4.5 h-4.5 text-green-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {job.reference_id ? `#${job.reference_id}` : 'Job'}
                        </p>
                        <p className="text-xs text-gray-500">
                          For {getCustomerName(job)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${STATUS_COLORS[job.status || ''] || 'bg-gray-100 text-gray-700'}`}>
                        {STATUS_LABELS[job.status || ''] || job.status}
                      </span>
                      {job.distance_km && (
                        <p className="text-[10px] text-gray-400 mt-1">{job.distance_km} km</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{job.pickup_location_text}</span>
                    </div>
                    <div className="ml-1 border-l border-dashed border-gray-300 h-2" />
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                      <span className="text-gray-700 truncate">{job.dropoff_location_text}</span>
                    </div>
                  </div>

                  {job.scheduled_pickup_time && (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Pickup: {formatDate(job.scheduled_pickup_time)}</span>
                    </div>
                  )}

                  {activeTab === 'assigned' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => acceptAssignment(job.id)}
                        disabled={acceptingJobId === job.id}
                        className="flex-1 btn-primary py-3 text-sm font-bold"
                      >
                        {acceptingJobId === job.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        Accept Assignment
                      </button>
                      <button
                        onClick={() => onNavigate(`/job/${job.id}`)}
                        className="btn-secondary py-3 px-4"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {activeTab === 'active' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => onNavigate(`/job/${job.id}`)}
                        className="flex-1 btn-primary py-2.5 text-xs"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        View / Navigate
                      </button>
                      <button
                        onClick={() => onNavigate('/courier/messages')}
                        className="btn-secondary py-2.5 px-3"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {activeTab === 'completed' && (
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-400">
                        {job.updated_at ? formatDate(job.updated_at) : ''}
                      </p>
                      <button
                        onClick={() => onNavigate(`/job/${job.id}`)}
                        className="text-xs text-blue-600 font-medium flex items-center gap-1 hover:text-blue-700"
                      >
                        View Details
                        <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {notifications.map(n => (
        <NotificationToast
          key={n.id}
          message={n.message}
          type={n.type}
          onClose={() => setNotifications(prev => prev.filter(x => x.id !== n.id))}
        />
      ))}
    </div>
  );
}
