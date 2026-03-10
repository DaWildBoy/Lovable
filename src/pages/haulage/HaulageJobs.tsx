import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  MapPin,
  Package,
  Loader2,
  CheckCircle,
  Truck,
  RefreshCw,
  Eye,
  ChevronRight,
  Calendar,
  Users,
  Radio,
  Camera,
  FileSignature,
  Image,
  Clock,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';
import { Database } from '../../lib/database.types';
import { LiveTrackingModal } from '../../components/LiveTrackingModal';

type Job = Database['public']['Tables']['jobs']['Row'];

interface PODStop {
  id: string;
  stop_id: string;
  job_id: string;
  required_type: string;
  status: string;
  photo_urls: string[];
  signature_image_url: string | null;
  signed_by_name: string | null;
  recipient_name: string | null;
  completed_at: string | null;
  notes: string | null;
}

interface DeliveryStop {
  id: string;
  job_id: string;
  stop_index: number;
  stop_type: string;
  location_text: string;
  status: string;
  arrived_at: string | null;
  completed_at: string | null;
  contact_name: string | null;
}

interface JobWithDetails extends Job {
  customer_profile?: {
    first_name: string | null;
    last_name: string | null;
    company_name: string | null;
    phone: string | null;
  };
  pod_stops?: PODStop[];
  delivery_stops?: DeliveryStop[];
}

interface HaulageJobsProps {
  onNavigate: (path: string) => void;
}

type TabType = 'available' | 'active' | 'completed';

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  bidding: 'Receiving Bids',
  assigned: 'Driver Assigned',
  on_way_to_pickup: 'Driver En Route to Pickup',
  cargo_collected: 'Cargo Collected',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  returning: 'Returning',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-100 text-blue-700',
  bidding: 'bg-blue-100 text-blue-700',
  assigned: 'bg-amber-100 text-amber-700',
  on_way_to_pickup: 'bg-cyan-100 text-cyan-700',
  cargo_collected: 'bg-teal-100 text-teal-700',
  in_transit: 'bg-blue-100 text-blue-700',
  delivered: 'bg-green-100 text-green-700',
  returning: 'bg-orange-100 text-orange-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PROGRESS_STEPS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'on_way_to_pickup', label: 'To Pickup' },
  { key: 'cargo_collected', label: 'Collected' },
  { key: 'in_transit', label: 'In Transit' },
  { key: 'delivered', label: 'Delivered' },
];

function getStepIndex(status: string): number {
  if (status === 'returning') return PROGRESS_STEPS.length;
  const idx = PROGRESS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

const STOP_STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-gray-100 text-gray-600',
  ENROUTE: 'bg-blue-100 text-blue-700',
  ARRIVED: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
};

export function HaulageJobs({ onNavigate }: HaulageJobsProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'available' || tab === 'active' || tab === 'completed') return tab;
    return 'active';
  });
  const [availableJobs, setAvailableJobs] = useState<JobWithDetails[]>([]);
  const [activeJobs, setActiveJobs] = useState<JobWithDetails[]>([]);
  const [completedJobs, setCompletedJobs] = useState<JobWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);
  const [expandedPod, setExpandedPod] = useState<string | null>(null);
  const [expandedStops, setExpandedStops] = useState<string | null>(null);
  const [podImagePreview, setPodImagePreview] = useState<string | null>(null);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchJobs = useCallback(async (isRefresh = false) => {
    if (!user) return;
    if (isRefresh) setRefreshing(true);

    try {
      const [availableResult, activeResult, completedResult] = await Promise.all([
        supabase
          .from('jobs')
          .select('*, customer_profile:profiles!jobs_customer_user_id_fkey(first_name, last_name, company_name, phone)')
          .in('status', ['open', 'bidding'])
          .order('created_at', { ascending: false })
          .limit(50),
        supabase
          .from('jobs')
          .select('*, customer_profile:profiles!jobs_customer_user_id_fkey(first_name, last_name, company_name, phone)')
          .eq('assigned_company_id', user.id)
          .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'returning'])
          .order('updated_at', { ascending: false }),
        supabase
          .from('jobs')
          .select('*, customer_profile:profiles!jobs_customer_user_id_fkey(first_name, last_name, company_name, phone)')
          .eq('assigned_company_id', user.id)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(50),
      ]);

      const activeJobsList = activeResult.data || [];
      const completedJobsList = completedResult.data || [];
      const allCompanyJobIds = [...activeJobsList, ...completedJobsList].map(j => j.id);

      let podMap: Record<string, PODStop[]> = {};
      let stopsMap: Record<string, DeliveryStop[]> = {};

      if (allCompanyJobIds.length > 0) {
        const [podResult, stopsResult] = await Promise.all([
          supabase
            .from('pod_stops')
            .select('*')
            .in('job_id', allCompanyJobIds),
          supabase
            .from('delivery_stops')
            .select('*')
            .in('job_id', allCompanyJobIds)
            .order('stop_index', { ascending: true }),
        ]);

        if (podResult.data) {
          for (const pod of podResult.data) {
            if (!podMap[pod.job_id]) podMap[pod.job_id] = [];
            podMap[pod.job_id].push(pod as PODStop);
          }
        }

        if (stopsResult.data) {
          for (const stop of stopsResult.data) {
            if (!stopsMap[stop.job_id]) stopsMap[stop.job_id] = [];
            stopsMap[stop.job_id].push(stop as DeliveryStop);
          }
        }
      }

      const enrichJob = (job: JobWithDetails): JobWithDetails => ({
        ...job,
        pod_stops: podMap[job.id] || [],
        delivery_stops: stopsMap[job.id] || [],
      });

      setAvailableJobs(availableResult.data || []);
      setActiveJobs(activeJobsList.map(enrichJob));
      setCompletedJobs(completedJobsList.map(enrichJob));
    } catch (error) {
      console.error('Error fetching haulage jobs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'available' || tab === 'active' || tab === 'completed') {
      setActiveTab(tab);
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('haulage-jobs-live')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'jobs',
          filter: `assigned_company_id=eq.${user.id}`,
        },
        () => {
          setLiveIndicator(true);
          fetchJobs();
          setTimeout(() => setLiveIndicator(false), 2000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pod_stops',
        },
        () => {
          setLiveIndicator(true);
          fetchJobs();
          setTimeout(() => setLiveIndicator(false), 2000);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_stops',
        },
        () => {
          setLiveIndicator(true);
          fetchJobs();
          setTimeout(() => setLiveIndicator(false), 2000);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, fetchJobs]);

  const getCustomerName = (job: JobWithDetails) => {
    if (job.customer_profile) {
      const name = `${job.customer_profile.first_name || ''} ${job.customer_profile.last_name || ''}`.trim();
      return job.customer_profile.company_name || name || 'Customer';
    }
    return 'Customer';
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-TT', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-TT', { hour: '2-digit', minute: '2-digit' });
  };

  const getPodSummary = (pods: PODStop[]) => {
    const completed = pods.filter(p => p.status === 'COMPLETED').length;
    const total = pods.filter(p => p.status !== 'NOT_REQUIRED').length;
    const hasPhotos = pods.some(p => p.photo_urls && p.photo_urls.length > 0);
    const hasSignatures = pods.some(p => !!p.signature_image_url);
    return { completed, total, hasPhotos, hasSignatures };
  };

  const currentJobs = activeTab === 'available' ? availableJobs : activeTab === 'active' ? activeJobs : completedJobs;

  const renderPodSection = (job: JobWithDetails) => {
    const pods = job.pod_stops || [];
    const activePods = pods.filter(p => p.status !== 'NOT_REQUIRED');
    if (activePods.length === 0) return null;

    const isExpanded = expandedPod === job.id;
    const summary = getPodSummary(pods);

    return (
      <div className="mt-3 border-t border-gray-100 pt-3">
        <button
          onClick={() => setExpandedPod(isExpanded ? null : job.id)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${
              summary.completed === summary.total && summary.total > 0
                ? 'bg-green-100' : 'bg-amber-100'
            }`}>
              <Camera className={`w-3.5 h-3.5 ${
                summary.completed === summary.total && summary.total > 0
                  ? 'text-green-600' : 'text-amber-600'
              }`} />
            </div>
            <span className="text-xs font-semibold text-gray-700">
              Proof of Delivery
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              summary.completed === summary.total && summary.total > 0
                ? 'bg-green-100 text-green-700'
                : 'bg-amber-100 text-amber-700'
            }`}>
              {summary.completed}/{summary.total}
            </span>
            {summary.hasPhotos && <Image className="w-3 h-3 text-blue-500" />}
            {summary.hasSignatures && <FileSignature className="w-3 h-3 text-teal-500" />}
          </div>
          {isExpanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-2">
            {activePods.map((pod, idx) => (
              <div key={pod.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase">
                    Stop {idx + 1} - {pod.required_type.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                    pod.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                    pod.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {pod.status}
                  </span>
                </div>

                {pod.photo_urls && pod.photo_urls.length > 0 && (
                  <div className="mb-2">
                    <p className="text-[10px] text-gray-500 mb-1 font-medium">Photos ({pod.photo_urls.length})</p>
                    <div className="flex gap-1.5 overflow-x-auto">
                      {pod.photo_urls.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setPodImagePreview(url)}
                          className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 border-white shadow-sm hover:border-blue-300 transition-colors"
                        >
                          <img src={url} alt={`POD ${i + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {pod.signature_image_url && (
                  <div className="mb-2">
                    <p className="text-[10px] text-gray-500 mb-1 font-medium">Signature</p>
                    <button
                      onClick={() => setPodImagePreview(pod.signature_image_url!)}
                      className="w-full h-16 bg-white rounded-lg border border-gray-200 overflow-hidden hover:border-blue-300 transition-colors"
                    >
                      <img src={pod.signature_image_url} alt="Signature" className="w-full h-full object-contain" />
                    </button>
                    {pod.signed_by_name && (
                      <p className="text-[10px] text-gray-500 mt-1">Signed by: {pod.signed_by_name}</p>
                    )}
                  </div>
                )}

                {pod.recipient_name && (
                  <p className="text-[10px] text-gray-600">Recipient: {pod.recipient_name}</p>
                )}

                {pod.completed_at && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Completed: {formatDate(pod.completed_at)}
                  </p>
                )}

                {pod.notes && (
                  <p className="text-[10px] text-gray-500 mt-1 italic">{pod.notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderDeliveryStops = (job: JobWithDetails) => {
    const stops = job.delivery_stops || [];
    if (stops.length === 0) return null;

    const isExpanded = expandedStops === job.id;
    const completedStops = stops.filter(s => s.status === 'COMPLETED').length;

    return (
      <div className="mt-2 border-t border-gray-100 pt-2">
        <button
          onClick={() => setExpandedStops(isExpanded ? null : job.id)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <span className="text-xs font-semibold text-gray-700">
              Delivery Stops
            </span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {completedStops}/{stops.length}
            </span>
          </div>
          {isExpanded
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>

        {isExpanded && (
          <div className="mt-2 space-y-1.5">
            {stops.map((stop) => (
              <div key={stop.id} className="flex items-center gap-2 text-xs bg-gray-50 rounded-lg px-3 py-2">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  stop.stop_type === 'PICKUP' ? 'bg-green-500' : 'bg-red-500'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-700 truncate">{stop.location_text}</p>
                  {stop.contact_name && (
                    <p className="text-[10px] text-gray-400">{stop.contact_name}</p>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                  STOP_STATUS_COLORS[stop.status] || 'bg-gray-100 text-gray-600'
                }`}>
                  {stop.status === 'NOT_STARTED' ? 'Pending' :
                   stop.status === 'ENROUTE' ? 'En Route' :
                   stop.status === 'ARRIVED' ? 'Arrived' : 'Done'}
                </span>
                {stop.arrived_at && (
                  <span className="text-[10px] text-gray-400 flex-shrink-0">
                    {formatTime(stop.arrived_at)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="gradient-header px-4 pt-8 pb-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="text-white/60 text-sm font-medium">Fleet Operations</p>
              {liveIndicator && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-green-500/20 rounded-full border border-green-400/30">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-[10px] text-green-300 font-semibold">LIVE</span>
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Jobs</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2.5 py-1.5 bg-white/10 rounded-lg border border-white/10">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] text-white/70 font-medium">Real-time</span>
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
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-3">
        <div className="flex gap-2 mb-4 bg-white rounded-xl p-1.5 shadow-sm border border-gray-100">
          <button
            onClick={() => setActiveTab('available')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'available'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Package className="w-4 h-4" />
            Available
            {availableJobs.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'available' ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'
              }`}>
                {availableJobs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'active'
                ? 'bg-teal-600 text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Truck className="w-4 h-4" />
            Active
            {activeJobs.length > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                activeTab === 'active' ? 'bg-white/25 text-white' : 'bg-teal-100 text-teal-700'
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
              {activeTab === 'available' && 'No Available Jobs'}
              {activeTab === 'active' && 'No Active Deliveries'}
              {activeTab === 'completed' && 'No Completed Deliveries'}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
              {activeTab === 'available' && 'New jobs will appear here when customers post deliveries.'}
              {activeTab === 'active' && 'Jobs assigned to your drivers will show here with live status updates.'}
              {activeTab === 'completed' && 'Completed deliveries will appear here.'}
            </p>
          </div>
        ) : activeTab === 'active' ? (
          <div className="space-y-3">
            {activeJobs.map(job => {
              const stepIndex = getStepIndex(job.status || 'assigned');
              const driverName = (job as any).assigned_driver_name || 'Unassigned';
              const vehicleLabel = (job as any).assigned_vehicle_label || '';
              const isReturning = job.status === 'returning';
              const canTrack = ['on_way_to_pickup', 'cargo_collected', 'in_transit', 'returning'].includes(job.status || '');
              const podSummary = getPodSummary(job.pod_stops || []);
              const locationUpdatedAt = (job as any).location_updated_at;

              return (
                <div
                  key={job.id}
                  className={`card overflow-hidden border-l-4 animate-fade-in-up ${isReturning ? 'border-l-orange-500' : 'border-l-teal-500'}`}
                >
                  <div className={`px-4 py-3 flex items-center justify-between ${isReturning ? 'bg-gradient-to-r from-orange-50/80 to-white' : 'bg-gradient-to-r from-teal-50/80 to-white'}`}>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center relative ${isReturning ? 'bg-orange-100' : 'bg-teal-100'}`}>
                        {isReturning ? <RotateCcw className="w-5 h-5 text-orange-600" /> : <Truck className="w-5 h-5 text-teal-600" />}
                        {canTrack && (
                          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white animate-pulse" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {job.reference_id ? `#${job.reference_id}` : 'Active Delivery'}
                        </p>
                        <p className="text-xs text-gray-500">For {getCustomerName(job)}</p>
                      </div>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${STATUS_COLORS[job.status || ''] || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_LABELS[job.status || ''] || job.status}
                    </span>
                  </div>

                  <div className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-3 p-2.5 bg-gray-50 rounded-lg">
                      <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-700 truncate">
                          Driver: {driverName}
                        </p>
                        {vehicleLabel && (
                          <p className="text-[10px] text-gray-500 truncate">Vehicle: {vehicleLabel}</p>
                        )}
                      </div>
                      {locationUpdatedAt && canTrack && (
                        <div className="flex items-center gap-1 text-[10px] text-green-600">
                          <Clock className="w-3 h-3" />
                          <span>{formatTime(locationUpdatedAt)}</span>
                        </div>
                      )}
                    </div>

                    {isReturning ? (
                      <div className="mb-3 p-2.5 bg-orange-50 border border-orange-200 rounded-lg">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-orange-800">Delivery Failed - Returning to Pickup</p>
                            <p className="text-[10px] text-orange-600 mt-0.5">
                              {(job as any).return_reason === 'customer_refused' && 'Reason: Customer Refused Item'}
                              {(job as any).return_reason === 'item_does_not_fit' && 'Reason: Item Does Not Fit'}
                              {(job as any).return_reason === 'wrong_address_unavailable' && 'Reason: Wrong Address / Unavailable'}
                              {(job as any).return_reason === 'item_damaged' && 'Reason: Item Damaged'}
                              {!(job as any).return_reason && 'Driver is returning item to pickup point'}
                            </p>
                          </div>
                          {(job as any).return_fee > 0 && (
                            <span className="text-xs font-bold text-orange-700 whitespace-nowrap">+${(job as any).return_fee} TTD</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mb-3">
                        {PROGRESS_STEPS.map((step, i) => (
                          <div key={step.key} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1">
                              <div className={`w-3.5 h-3.5 rounded-full transition-all ${
                                i <= stepIndex
                                  ? 'bg-teal-500 shadow-sm shadow-teal-200'
                                  : 'bg-gray-200'
                              } ${i === stepIndex ? 'ring-4 ring-teal-100' : ''}`} />
                              <p className={`text-[9px] mt-1 text-center leading-tight ${
                                i <= stepIndex ? 'text-teal-600 font-semibold' : 'text-gray-400'
                              }`}>
                                {step.label}
                              </p>
                            </div>
                            {i < PROGRESS_STEPS.length - 1 && (
                              <div className={`h-0.5 flex-1 -mt-3 mx-0.5 rounded-full ${
                                i < stepIndex ? 'bg-teal-400' : 'bg-gray-200'
                              }`} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

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

                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                      <div className="flex items-center gap-3">
                        {job.distance_km && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            {job.distance_km} km
                          </span>
                        )}
                        {podSummary.total > 0 && (
                          <span className={`flex items-center gap-1 ${
                            podSummary.completed === podSummary.total ? 'text-green-600' : 'text-amber-600'
                          }`}>
                            <Camera className="w-3 h-3" />
                            POD {podSummary.completed}/{podSummary.total}
                          </span>
                        )}
                      </div>
                      {job.customer_offer_ttd && (
                        <span className="font-semibold text-gray-700">TTD ${job.customer_offer_ttd}</span>
                      )}
                    </div>

                    {renderDeliveryStops(job)}
                    {renderPodSection(job)}

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => onNavigate(`/job/${job.id}`)}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-xs font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        View Details
                      </button>
                      {canTrack && (
                        <button
                          onClick={() => setTrackingJobId(job.id)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-all text-xs font-medium"
                        >
                          <Radio className="w-3.5 h-3.5" />
                          Track Live
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : activeTab === 'available' ? (
          <div className="space-y-3">
            {availableJobs.map(job => (
              <button
                key={job.id}
                onClick={() => onNavigate(`/job/${job.id}`)}
                className="w-full card p-4 text-left hover:shadow-md transition-shadow border-l-4 border-l-blue-400"
              >
                <div className="flex items-start justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Package className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {job.reference_id ? `#${job.reference_id}` : 'Job'}
                      </p>
                      <p className="text-xs text-gray-500">{getCustomerName(job)}</p>
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

                <div className="space-y-1.5 mb-2.5">
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

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{job.cargo_size_category || 'Standard'}</span>
                    {job.delivery_type === 'scheduled' && job.scheduled_pickup_time && (
                      <>
                        <span className="text-gray-300">|</span>
                        <Calendar className="w-3 h-3" />
                        <span>{formatDate(job.scheduled_pickup_time)}</span>
                      </>
                    )}
                  </div>
                  <span className="font-bold text-gray-900 text-sm">TTD ${job.customer_offer_ttd}</span>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex items-center justify-end">
                  <span className="text-xs text-blue-600 font-medium flex items-center gap-1">
                    View & Accept
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {completedJobs.map(job => {
              const podSummary = getPodSummary(job.pod_stops || []);

              return (
                <div
                  key={job.id}
                  className="card p-4 border-l-4 border-l-green-400"
                >
                  <div className="flex items-start justify-between mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 bg-green-100 rounded-xl flex items-center justify-center">
                        <CheckCircle className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {job.reference_id ? `#${job.reference_id}` : 'Completed'}
                        </p>
                        <p className="text-xs text-gray-500">{getCustomerName(job)}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold px-2 py-1 rounded-lg bg-green-100 text-green-700">
                      Completed
                    </span>
                  </div>

                  <div className="space-y-1.5 mb-2.5">
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

                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      {(job as any).assigned_driver_name && (
                        <span>Driver: {(job as any).assigned_driver_name}</span>
                      )}
                      {podSummary.total > 0 && (
                        <span className="flex items-center gap-1 text-green-600">
                          <Camera className="w-3 h-3" />
                          POD {podSummary.completed}/{podSummary.total}
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      {job.customer_offer_ttd && (
                        <span className="font-bold text-gray-900 text-sm">TTD ${job.customer_offer_ttd}</span>
                      )}
                      {job.updated_at && (
                        <p className="text-[10px] text-gray-400 mt-0.5">{formatDate(job.updated_at)}</p>
                      )}
                    </div>
                  </div>

                  {renderDeliveryStops(job)}
                  {renderPodSection(job)}

                  <button
                    onClick={() => onNavigate(`/job/${job.id}`)}
                    className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-xs font-medium"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Full Details
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {trackingJobId && (
        <LiveTrackingModal
          isOpen={true}
          jobId={trackingJobId}
          onClose={() => setTrackingJobId(null)}
        />
      )}

      {podImagePreview && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPodImagePreview(null)}
        >
          <div className="max-w-2xl max-h-[90vh] w-full">
            <img
              src={podImagePreview}
              alt="POD Preview"
              className="w-full h-auto max-h-[85vh] object-contain rounded-xl"
            />
            <p className="text-center text-white/60 text-sm mt-3">Tap anywhere to close</p>
          </div>
        </div>
      )}
    </div>
  );
}
