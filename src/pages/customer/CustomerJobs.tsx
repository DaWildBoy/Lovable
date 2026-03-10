import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { MapPin, Package, Clock, DollarSign, Loader2, Truck, CheckCircle2, Navigation, Camera, AlertCircle, Star, Radio, FileSignature, Image as ImageIcon, Layers, MessageCircle, TrendingUp, Bike, ShoppingBag, Trash2, ShoppingCart } from 'lucide-react';
import { getJobTypeInfo } from '../../lib/jobTypeUtils';
import { Database } from '../../lib/database.types';
import { NotificationToast } from '../../components/NotificationToast';
import { LiveTrackingModal } from '../../components/LiveTrackingModal';
import { RateDeliveryCard } from '../../components/RateDeliveryCard';
import { AssignedCompanyCard } from '../../components/AssignedCompanyCard';
import { ChatView } from '../../components/messaging/ChatView';
import { getOrCreateJobConversation } from '../../lib/messaging';
import { isBackhaulOpportunity, calculateBackhaulDiscount } from '../../lib/backhaulMatching';

type Job = Database['public']['Tables']['jobs']['Row'];
type Bid = Database['public']['Tables']['bids']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];
type CargoItem = Database['public']['Tables']['cargo_items']['Row'];

interface CourierWithProfile {
  id: string;
  user_id: string;
  vehicle_type: string | null;
  profiles: {
    full_name: string;
  } | null;
}

interface JobWithDetails extends Job {
  bids?: Bid[];
  courier?: CourierWithProfile | null;
  cargo_items?: CargoItem[];
}

interface CustomerJobsProps {
  onNavigate: (path: string) => void;
}

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'warning';
}

export function CustomerJobs({ onNavigate }: CustomerJobsProps) {
  const { profile } = useAuth();
  const [jobs, setJobs] = useState<JobWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const getInitialFilter = (): 'all' | 'pending' | 'active' | 'completed' => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam === 'pending' || filterParam === 'active' || filterParam === 'completed') {
      return filterParam;
    }
    return 'all';
  };

  const [filter, setFilter] = useState<'all' | 'pending' | 'active' | 'completed'>(getInitialFilter());
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);
  const [viewingProofItem, setViewingProofItem] = useState<CargoItem | null>(null);
  const [chatConversationId, setChatConversationId] = useState<string | null>(null);

  const getStatusNotificationMessage = (status: string): string => {
    const messages: Record<string, string> = {
      'assigned': 'Job Accepted! A courier has been assigned to your delivery.',
      'on_way_to_pickup': 'Courier is on the way to collect your cargo!',
      'cargo_collected': 'Cargo has been picked up and is ready for delivery!',
      'in_transit': 'Your cargo is now in transit to the destination.',
      'delivered': 'Cargo has been delivered! Waiting for delivery confirmation.',
      'completed': 'Delivery completed successfully!',
    };
    return messages[status] || `Job status updated to: ${status}`;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filterParam = params.get('filter');
    if (filterParam === 'pending' || filterParam === 'active' || filterParam === 'completed') {
      setFilter(filterParam);
    }
  }, []);

  useEffect(() => {
    fetchJobs();

    const channel = supabase
      .channel('customer-jobs')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'jobs', filter: `customer_user_id=eq.${profile!.id}` },
        (payload) => {
          const updatedJob = payload.new as Job;
          const oldJob = payload.old as Job;

          setJobs(prevJobs =>
            prevJobs.map(job =>
              job.id === updatedJob.id ? { ...job, ...updatedJob } : job
            )
          );

          if (oldJob.status !== updatedJob.status) {
            const notification: Notification = {
              id: `${Date.now()}-${updatedJob.id}`,
              message: getStatusNotificationMessage(updatedJob.status),
              type: updatedJob.status === 'completed' ? 'success' : 'info',
            };
            setNotifications(prev => [...prev, notification]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [filter]);

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const fetchJobs = async () => {
    try {
      let query = supabase
        .from('jobs')
        .select(`
          *,
          cargo_items(*),
          courier:assigned_courier_id(
            id,
            user_id,
            vehicle_type,
            profiles!couriers_user_id_fkey(full_name)
          )
        `)
        .eq('customer_user_id', profile!.id)
        .order('created_at', { ascending: false});

      if (filter === 'pending') {
        query = query.in('status', ['open', 'bidding']);
      } else if (filter === 'active') {
        query = query.in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'in_progress', 'returning']);
      } else if (filter === 'completed') {
        query = query.eq('status', 'completed');
      }

      const { data, error } = await query;

      if (error) throw error;
      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching jobs:', error);
    } finally {
      setLoading(false);
    }
  };


  const addNotification = (message: string, type: 'success' | 'info' | 'warning' = 'info') => {
    const id = Date.now().toString();
    setNotifications(prev => [...prev, { id, message, type }]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800';
      case 'bidding':
        return 'bg-yellow-100 text-yellow-800';
      case 'assigned':
        return 'bg-purple-100 text-purple-800';
      case 'on_way_to_pickup':
        return 'bg-yellow-100 text-yellow-800';
      case 'cargo_collected':
        return 'bg-orange-100 text-orange-800';
      case 'in_transit':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-orange-100 text-orange-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'returning':
        return 'bg-red-100 text-red-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      'open': 'Open',
      'bidding': 'Receiving Bids',
      'assigned': 'Courier Assigned',
      'on_way_to_pickup': 'Courier En Route to Pickup',
      'cargo_collected': 'Cargo Collected',
      'in_transit': 'In Transit',
      'delivered': 'Delivered - Awaiting Proof',
      'returning': 'Returning to Base',
      'completed': 'Completed',
      'cancelled': 'Cancelled',
    };
    return labels[status] || status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const renderStatusTimeline = (job: Job) => {
    const statuses = ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'completed'];
    const currentIndex = statuses.indexOf(job.status);

    if (currentIndex === -1) return null;

    const steps = [
      { label: 'Assigned', icon: CheckCircle2 },
      { label: 'En Route', icon: Navigation },
      { label: 'Picked Up', icon: Package },
      { label: 'In Transit', icon: Truck },
      { label: 'Delivered', icon: MapPin },
      { label: 'Completed', icon: CheckCircle2 },
    ];

    return (
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs font-medium text-gray-700 mb-3">Delivery Progress</p>
        <div className="relative">
          <div className="absolute top-4 left-0 right-0 h-0.5 bg-gray-200">
            <div
              className="h-full bg-green-600 transition-all duration-500"
              style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
            />
          </div>
          <div className="relative flex justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const isCompleted = index <= currentIndex;
              const isCurrent = index === currentIndex;

              return (
                <div key={index} className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
                    isCompleted
                      ? 'bg-green-600 border-green-600 text-white'
                      : 'bg-white border-gray-300 text-gray-400'
                  } ${isCurrent ? 'ring-4 ring-green-100' : ''}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <p className={`text-xs mt-2 text-center ${
                    isCompleted ? 'text-gray-900 font-medium' : 'text-gray-500'
                  }`}>
                    {step.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      {notifications.map((notification) => (
        <NotificationToast
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onClose={() => removeNotification(notification.id)}
        />
      ))}

      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 mb-3">My Jobs</h1>
          <div className="flex gap-1.5 sm:gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                filter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                filter === 'pending'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                filter === 'active'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 sm:px-4 py-2 rounded-lg font-medium text-xs sm:text-sm transition-colors ${
                filter === 'completed'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Completed
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-4">
        {jobs.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-600 mb-6">
              {filter === 'all'
                ? "You haven't created any deliveries yet"
                : filter === 'pending'
                ? 'No jobs awaiting quotes at the moment'
                : filter === 'active'
                ? 'No active deliveries at the moment'
                : 'No completed deliveries yet'}
            </p>
            {filter === 'all' && (
              <button
                onClick={() => onNavigate('/create-job')}
                className="bg-moveme-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all"
              >
                Create Your First Job
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isExpanded = expandedJob === job.id;
              const showTimeline = ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'returning', 'completed'].includes(job.status);
              const isBackhaul = isBackhaulOpportunity(job);
              const backhaulDiscount = isBackhaul ? calculateBackhaulDiscount(job.customer_offer_ttd) : 0;

              return (
                <div
                  key={job.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all"
                >
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${getStatusColor(job.status)}`}>
                          {getStatusLabel(job.status)}
                        </span>
                        {(() => {
                          const jt = getJobTypeInfo((job as any).job_type);
                          const IconMap = { Package, Bike, ShoppingBag, Trash2, ShoppingCart };
                          const Icon = IconMap[jt.iconName];
                          return (job as any).job_type && (job as any).job_type !== 'standard' ? (
                            <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold ${jt.badgeBg} ${jt.badgeText} border ${jt.badgeBorder}`}>
                              <Icon className="w-3 h-3" />
                              {jt.shortLabel}
                            </span>
                          ) : null;
                        })()}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-gray-900">TTD ${((job as any).customer_total || Math.round(job.customer_offer_ttd * 1.225 * 100) / 100).toFixed(2)}</span>
                        {isBackhaul && job.status === 'open' && (
                          <div className="mt-1">
                            <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-full font-semibold border border-green-200">
                              <TrendingUp className="w-3 h-3" />
                              Smart Deal - 10% Off (${backhaulDiscount} saved)
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 mb-3">
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-600 font-medium">Pickup</p>
                          <p className="text-sm text-gray-900">{job.pickup_location_text}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-600 font-medium">Dropoff</p>
                          <p className="text-sm text-gray-900">{job.dropoff_location_text}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-3">
                      <div className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5" />
                        <span className="capitalize">{job.cargo_size_category}</span>
                        {job.cargo_size_category === 'large' && job.cargo_items && job.cargo_items.length > 0 && (
                          <>
                            {job.cargo_items.some((item: any) => item.dimensions_length && item.dimensions_width && item.dimensions_height) ? (
                              <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px] font-semibold">+Dims</span>
                            ) : (
                              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-semibold">No dims</span>
                            )}
                          </>
                        )}
                      </div>
                      {job.urgency_hours && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Within {job.urgency_hours}h</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <span>{job.distance_km} km</span>
                      </div>
                      {job.proof_of_delivery_required && job.proof_of_delivery_required !== 'NONE' && (
                        <div className="flex items-center gap-1">
                          <FileSignature className="w-3.5 h-3.5" />
                          <span>
                            {job.proof_of_delivery_required === 'PHOTO' && 'Photo POD'}
                            {job.proof_of_delivery_required === 'SIGNATURE' && 'E-Signature'}
                            {job.proof_of_delivery_required === 'PHOTO_AND_SIGNATURE' && 'Photo + E-Sig'}
                          </span>
                        </div>
                      )}
                      {job.is_fragile && (
                        <div className="flex items-center gap-1 text-orange-600">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Fragile</span>
                        </div>
                      )}
                    </div>

                    {showTimeline && (
                      <>
                        {['on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'returning'].includes(job.status) && (
                          <div className="mb-3">
                            <button
                              onClick={() => setTrackingJobId(job.id)}
                              className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2 shadow-md"
                            >
                              <Radio className="w-5 h-5 animate-pulse" />
                              Track Live on Map
                            </button>
                          </div>
                        )}

                        {job.assigned_company_id && job.assigned_company_name && (
                          <div className="mb-3">
                            <AssignedCompanyCard
                              companyName={job.assigned_company_name}
                              companyLogoUrl={job.assigned_company_logo_url}
                              isCompleted={job.status === 'completed'}
                            />
                          </div>
                        )}

                        {job.status === 'delivered' && job.proof_of_delivery_required && job.proof_of_delivery_required !== 'NONE' && (
                          <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-xs font-medium text-yellow-900">
                                {job.proof_of_delivery_required === 'PHOTO' && 'Photo Proof Required'}
                                {job.proof_of_delivery_required === 'SIGNATURE' && 'E-Signature Required'}
                                {job.proof_of_delivery_required === 'PHOTO_AND_SIGNATURE' && 'Photo + E-Signature Required'}
                              </p>
                              <p className="text-xs text-yellow-700 mt-1">Waiting for courier to upload delivery confirmation</p>
                            </div>
                          </div>
                        )}

                        {job.status === 'completed' && job.assigned_courier_id && job.courier && profile && (
                          <div className="mb-3">
                            <RateDeliveryCard
                              jobId={job.id}
                              providerId={job.assigned_courier_id}
                              providerName={job.courier?.profiles?.full_name || 'Courier'}
                              providerType="courier"
                              vehicleInfo={job.courier?.vehicle_type || undefined}
                              raterUserId={profile.id}
                              raterAccountType={profile.business_type === 'retail' ? 'retail' : 'customer'}
                              onRatingSubmitted={() => {
                                addNotification('Rating submitted successfully', 'success');
                              }}
                              onNotification={addNotification}
                            />
                          </div>
                        )}

                        {job.cargo_items && job.cargo_items.length > 0 && job.cargo_items.some(item => item.status === 'delivered') && (
                          <div className="mb-3 border-t border-gray-200 pt-3">
                            <div className="flex items-center gap-2 mb-3">
                              <Layers className="w-4 h-4 text-blue-600" />
                              <h4 className="text-sm font-semibold text-gray-900">Delivery Proofs</h4>
                            </div>
                            <div className="space-y-2">
                              {job.cargo_items.filter(item => item.status === 'delivered').map((item) => (
                                <div
                                  key={item.id}
                                  className="p-3 bg-green-50 border border-green-200 rounded-lg"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <Package className="w-4 h-4 text-green-600" />
                                        <p className="font-medium text-sm text-gray-900 capitalize">
                                          {item.cargo_category === 'other' ? item.cargo_category_custom : item.cargo_category}
                                        </p>
                                        <span className="ml-auto px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                                          Delivered
                                        </span>
                                      </div>
                                      {item.dropoff_location_text && (
                                        <div className="mt-1 mb-2 p-2 bg-purple-50 border border-purple-200 rounded">
                                          <div className="flex items-start gap-1">
                                            <MapPin className="w-3 h-3 text-purple-600 mt-0.5 flex-shrink-0" />
                                            <div className="flex-1">
                                              <p className="text-xs font-medium text-purple-900">Delivered to:</p>
                                              <p className="text-xs text-purple-700">{item.dropoff_location_text}</p>
                                              {item.dropoff_contact_name && (
                                                <p className="text-xs text-purple-600 mt-0.5">
                                                  For: {item.dropoff_contact_name}
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        </div>
                                      )}
                                      {item.delivered_to_name && (
                                        <p className="text-xs text-gray-700 mb-1">
                                          Received by: <span className="font-medium">{item.delivered_to_name}</span>
                                        </p>
                                      )}
                                      {item.delivered_at && (
                                        <p className="text-xs text-gray-600">
                                          {new Date(item.delivered_at).toLocaleString()}
                                        </p>
                                      )}
                                      {item.delivery_notes_from_courier && (
                                        <p className="text-xs text-gray-600 mt-1 italic">
                                          Note: {item.delivery_notes_from_courier}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => setViewingProofItem(item)}
                                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                                    >
                                      <ImageIcon className="w-3.5 h-3.5" />
                                      View Proof
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <button
                              onClick={async () => {
                                if (!user || !job.courier) return;
                                try {
                                  const convId = await getOrCreateJobConversation(job.id);
                                  setChatConversationId(convId);
                                } catch (err) {
                                  console.error('Error opening chat:', err);
                                }
                              }}
                              className="flex-1 py-2.5 px-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 shadow-sm text-xs"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>Message</span>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedJob(isExpanded ? null : job.id);
                              }}
                              className="flex-1 py-2.5 px-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-1.5 shadow-sm text-xs"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              <span>{isExpanded ? 'Hide' : 'Track'}</span>
                            </button>
                          </div>
                          <button
                            onClick={() => onNavigate(`/job/${job.id}`)}
                            className="w-full py-2.5 px-4 bg-gray-100 text-gray-800 rounded-lg text-sm font-medium hover:bg-gray-200 transition-all border border-gray-300"
                          >
                            View Full Details
                          </button>
                        </div>

                        {isExpanded && renderStatusTimeline(job)}
                      </>
                    )}

                    {!showTimeline && (
                      <button
                        onClick={() => onNavigate(`/job/${job.id}`)}
                        className="w-full mt-2 py-2 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-all"
                      >
                        View Details
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <LiveTrackingModal
        isOpen={trackingJobId !== null}
        onClose={() => setTrackingJobId(null)}
        jobId={trackingJobId || ''}
      />

      {chatConversationId && (
        <div className="fixed inset-0 bg-white z-[60]">
          <ChatView
            conversationId={chatConversationId}
            onBack={() => setChatConversationId(null)}
          />
        </div>
      )}

      {viewingProofItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setViewingProofItem(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">Delivery Proof</h3>
              <button onClick={() => setViewingProofItem(null)} className="text-gray-400 hover:text-gray-600">
                <span className="text-2xl">&times;</span>
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Item:</p>
                <p className="text-gray-900 capitalize">
                  {viewingProofItem.cargo_category === 'other' ? viewingProofItem.cargo_category_custom : viewingProofItem.cargo_category} ({viewingProofItem.cargo_size_category})
                </p>
                {viewingProofItem.cargo_size_category === 'large' && viewingProofItem.dimensions_length && viewingProofItem.dimensions_width && viewingProofItem.dimensions_height && (
                  <p className="text-sm text-blue-600 mt-1">
                    Dimensions: {Number(viewingProofItem.dimensions_length)}{viewingProofItem.dimensions_length_unit || viewingProofItem.dimensions_unit || 'ft'} x {Number(viewingProofItem.dimensions_width)}{viewingProofItem.dimensions_width_unit || viewingProofItem.dimensions_unit || 'in'} x {Number(viewingProofItem.dimensions_height)}{viewingProofItem.dimensions_height_unit || viewingProofItem.dimensions_unit || 'in'}
                  </p>
                )}
              </div>

              {viewingProofItem.dropoff_location_text && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Delivery Location:</p>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm text-purple-900">{viewingProofItem.dropoff_location_text}</p>
                        {viewingProofItem.dropoff_contact_name && (
                          <p className="text-sm text-purple-700 mt-1">
                            For: {viewingProofItem.dropoff_contact_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {viewingProofItem.delivered_to_name && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Received By:</p>
                  <p className="text-gray-900">{viewingProofItem.delivered_to_name}</p>
                </div>
              )}

              {viewingProofItem.delivered_at && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Delivery Time:</p>
                  <p className="text-gray-900">{new Date(viewingProofItem.delivered_at).toLocaleString()}</p>
                </div>
              )}

              {viewingProofItem.delivery_proof_photo_url && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Delivery Photo:</p>
                  <img
                    src={supabase.storage.from('delivery-proofs').getPublicUrl(viewingProofItem.delivery_proof_photo_url).data.publicUrl}
                    alt="Delivery proof"
                    className="w-full rounded-lg border border-gray-300"
                  />
                </div>
              )}

              {viewingProofItem.delivery_signature_url && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Recipient Signature:</p>
                  <div className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                    <img
                      src={supabase.storage.from('delivery-proofs').getPublicUrl(viewingProofItem.delivery_signature_url).data.publicUrl}
                      alt="Recipient signature"
                      className="w-full h-40 object-contain"
                    />
                  </div>
                </div>
              )}

              {viewingProofItem.delivery_notes_from_courier && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-1">Courier Notes:</p>
                  <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">{viewingProofItem.delivery_notes_from_courier}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
