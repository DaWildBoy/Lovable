import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  Package,
  Truck,
  MapPin,
  Loader2,
  Clock,
  AlertCircle,
  Building2,
  CheckCircle,
  Navigation,
  Phone,
  MessageSquare,
  ChevronRight,
  RotateCcw,
} from 'lucide-react';
import { Database } from '../../lib/database.types';
import { CourierOnlineToggle } from '../../components/courier/CourierOnlineToggle';
import { isMobileDevice } from '../../lib/deviceDetection';

type Job = Database['public']['Tables']['jobs']['Row'];
type Courier = Database['public']['Tables']['couriers']['Row'];

interface CustomerInfo {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface AssignedJob extends Job {
  customer?: CustomerInfo;
}

interface CompanyDriverHomeProps {
  onNavigate: (path: string) => void;
}

const STATUS_STEPS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'on_way_to_pickup', label: 'To Pickup' },
  { key: 'cargo_collected', label: 'Collected' },
  { key: 'in_transit', label: 'In Transit' },
];

const ACTIVE_STATUSES = ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'delivered', 'returning'];

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

export function CompanyDriverHome({ onNavigate }: CompanyDriverHomeProps) {
  const { profile, user } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [companyLogo, setCompanyLogo] = useState<string | null>(null);
  const [activeJobs, setActiveJobs] = useState<AssignedJob[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [completedToday, setCompletedToday] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!user) return;
    try {
      const { data: courierData } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      setCourier(courierData);

      if (!courierData || courierData.verification_status !== 'approved') {
        setLoading(false);
        return;
      }

      const linkedCompanyId = (profile as any)?.linked_company_id;
      if (linkedCompanyId) {
        const { data: companyProfile } = await supabase
          .from('profiles')
          .select('company_name, full_name, haulage_company_logo_url')
          .eq('id', linkedCompanyId)
          .maybeSingle();

        setCompanyName(companyProfile?.company_name || companyProfile?.full_name || null);
        setCompanyLogo(companyProfile?.haulage_company_logo_url || null);
      }

      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('assigned_courier_id', courierData.id)
        .in('status', ACTIVE_STATUSES)
        .order('updated_at', { ascending: false });

      if (jobs && jobs.length > 0) {
        const customerIds = [...new Set(jobs.map(j => j.customer_user_id))];
        let customerMap: Record<string, CustomerInfo> = {};
        if (customerIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, phone')
            .in('id', customerIds);
          if (profiles) {
            customerMap = Object.fromEntries(profiles.map(p => [p.id, p]));
          }
        }
        setActiveJobs(jobs.map(job => ({ ...job, customer: customerMap[job.customer_user_id] })));
      }

      const { count: pendingAssignments } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_courier_id', courierData.id)
        .eq('status', 'assigned');

      setPendingCount(pendingAssignments || 0);

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: todayCompleted } = await supabase
        .from('jobs')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_courier_id', courierData.id)
        .eq('status', 'completed')
        .gte('updated_at', todayStart.toISOString());

      setCompletedToday(todayCompleted || 0);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  const verificationStatus = courier?.verification_status;

  if (!verificationStatus || verificationStatus === 'pending') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 flex items-center justify-center p-4">
        <div className="card p-8 w-full max-w-md text-center animate-fade-in-up">
          <div className="inline-flex p-4 rounded-2xl bg-warning-50 mb-5">
            <Clock className="w-10 h-10 text-warning-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Verification Pending</h1>
          <p className="text-gray-500 text-sm mb-5 leading-relaxed">
            Your driver account is being reviewed. You'll be notified once approved.
          </p>
        </div>
      </div>
    );
  }

  if (verificationStatus === 'rejected') {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 flex items-center justify-center p-4">
        <div className="card p-8 w-full max-w-md text-center animate-fade-in-up">
          <div className="inline-flex p-4 rounded-2xl bg-error-50 mb-5">
            <AlertCircle className="w-10 h-10 text-error-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-3 tracking-tight">Application Not Approved</h1>
          <p className="text-gray-500 text-sm leading-relaxed">
            Your driver application was not approved. Please contact your company administrator.
          </p>
        </div>
      </div>
    );
  }

  const inProgressJobs = activeJobs.filter(j =>
    ['on_way_to_pickup', 'cargo_collected', 'in_transit', 'delivered', 'returning'].includes(j.status || '')
  );
  const awaitingAcceptance = activeJobs.filter(j => j.status === 'assigned');

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-blue-800 px-4 pt-8 pb-12">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-1">
            {companyLogo ? (
              <img src={companyLogo} alt="" className="w-8 h-8 rounded-lg object-cover border border-white/30" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center border border-white/20">
                <Building2 className="w-4 h-4 text-white/80" />
              </div>
            )}
            <p className="text-white/60 text-sm font-medium">{companyName || 'Company Driver'}</p>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {profile?.first_name || 'Driver'}
          </h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6 animate-fade-in-up">
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

        {courier && (
          <div className="mb-4">
            <CourierOnlineToggle courierId={courier.id} initialOnline={courier.is_online || false} visibilityLabel="You are visible to your company" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-4">
          <button
            onClick={() => onNavigate('/courier/jobs?tab=active')}
            className="stat-card"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-amber-100 rounded-lg mb-3 mx-auto">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900 text-center">{pendingCount}</p>
            <p className="text-xs text-gray-600 text-center mt-1">Pending</p>
          </button>

          <button
            onClick={() => onNavigate('/courier/jobs?tab=active')}
            className="stat-card"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-lg mb-3 mx-auto">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900 text-center">{inProgressJobs.length}</p>
            <p className="text-xs text-gray-600 text-center mt-1">In Progress</p>
          </button>

          <button
            onClick={() => onNavigate('/courier/jobs?tab=completed')}
            className="stat-card"
          >
            <div className="flex items-center justify-center w-10 h-10 bg-green-100 rounded-lg mb-3 mx-auto">
              <CheckCircle className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900 text-center">{completedToday}</p>
            <p className="text-xs text-gray-600 text-center mt-1">Today</p>
          </button>
        </div>

        {awaitingAcceptance.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">New Assignments</h2>
              <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full">
                {awaitingAcceptance.length} pending
              </span>
            </div>
            <div className="space-y-3">
              {awaitingAcceptance.map(job => (
                <button
                  key={job.id}
                  onClick={() => onNavigate(`/job/${job.id}`)}
                  className="w-full card p-4 text-left border-l-4 border-l-amber-400 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                        <Package className="w-4 h-4 text-amber-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          {job.reference_id ? `#${job.reference_id}` : 'New Assignment'}
                        </p>
                        <p className="text-xs text-gray-500">{job.distance_km ? `${job.distance_km} km` : 'Distance TBD'}</p>
                      </div>
                    </div>
                    <span className="text-xs font-bold bg-amber-50 text-amber-700 px-2 py-1 rounded-lg">
                      Awaiting
                    </span>
                  </div>
                  <div className="space-y-1.5">
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
                  <div className="mt-3 flex items-center justify-end text-xs text-blue-600 font-medium">
                    View Details
                    <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {inProgressJobs.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Active Deliveries</h2>
              <button
                onClick={() => onNavigate('/courier/jobs?tab=active')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-0.5 transition-colors"
              >
                View All
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="space-y-3">
              {inProgressJobs.map(job => {
                const isReturning = job.status === 'returning';
                const stepIndex = getStepIndex(job.status || 'assigned');
                const customerName = job.customer
                  ? `${job.customer.first_name || ''} ${job.customer.last_name || ''}`.trim() || 'Customer'
                  : 'Customer';

                return (
                  <div
                    key={job.id}
                    className={`card overflow-hidden border-l-4 animate-fade-in-up ${
                      isReturning ? 'border-l-red-500' : 'border-l-blue-500'
                    }`}
                  >
                    <div className={`px-4 py-3 flex items-center justify-between ${
                      isReturning
                        ? 'bg-gradient-to-r from-red-50 to-white'
                        : 'bg-gradient-to-r from-blue-50/80 to-white'
                    }`}>
                      <div className="flex items-center gap-2.5">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                          isReturning ? 'bg-red-100' : 'bg-blue-100'
                        }`}>
                          {isReturning ? (
                            <RotateCcw className="w-5 h-5 text-red-600" />
                          ) : (
                            <Truck className="w-5 h-5 text-blue-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {isReturning
                              ? 'Returning to Base'
                              : job.reference_id ? `Job #${job.reference_id}` : 'Active Delivery'}
                          </p>
                          <p className={`text-xs ${isReturning ? 'text-red-600' : 'text-gray-500'}`}>
                            {isReturning ? 'Item must be returned to pickup' : `For ${customerName}`}
                          </p>
                        </div>
                      </div>
                      {!isReturning && job.distance_km && (
                        <p className="text-xs text-gray-400 font-medium">{job.distance_km} km</p>
                      )}
                    </div>

                    <div className="px-4 py-3">
                      {isReturning ? (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-red-600 flex-shrink-0" />
                            <div>
                              <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Return to</p>
                              <p className="text-sm text-gray-800 font-medium">{job.pickup_location_text || 'Original pickup point'}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center gap-1 mb-3">
                            {STATUS_STEPS.map((step, i) => (
                              <div key={step.key} className="flex items-center flex-1">
                                <div className="flex flex-col items-center flex-1">
                                  <div className={`w-3.5 h-3.5 rounded-full transition-all ${
                                    i <= stepIndex
                                      ? 'bg-blue-500 shadow-sm shadow-blue-200'
                                      : 'bg-gray-200'
                                  } ${i === stepIndex ? 'ring-4 ring-blue-100' : ''}`} />
                                  <p className={`text-[9px] mt-1 text-center leading-tight ${
                                    i <= stepIndex ? 'text-blue-600 font-semibold' : 'text-gray-400'
                                  }`}>
                                    {step.label}
                                  </p>
                                </div>
                                {i < STATUS_STEPS.length - 1 && (
                                  <div className={`h-0.5 flex-1 -mt-3 mx-0.5 rounded-full ${
                                    i < stepIndex ? 'bg-blue-400' : 'bg-gray-200'
                                  }`} />
                                )}
                              </div>
                            ))}
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
                        </>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => onNavigate(`/job/${job.id}`)}
                          className={`flex-1 py-2.5 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 ${
                            isReturning
                              ? 'bg-red-600 hover:bg-red-700 text-white'
                              : 'btn-primary'
                          }`}
                        >
                          {isReturning ? (
                            <>
                              <Navigation className="w-3.5 h-3.5" />
                              Navigate Return
                            </>
                          ) : (
                            <>
                              <Package className="w-3.5 h-3.5" />
                              Job Details
                            </>
                          )}
                        </button>
                        {!isReturning && (
                          <button
                            onClick={() => onNavigate('/courier/jobs?tab=active')}
                            className="flex-1 py-2.5 text-xs font-semibold rounded-xl border-2 border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors flex items-center justify-center gap-1.5"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            Active Jobs
                          </button>
                        )}
                        <button
                          onClick={() => onNavigate('/courier/messages')}
                          className="btn-secondary py-2.5 px-3"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>
                        {job.customer?.phone && (
                          <a
                            href={`tel:${job.customer.phone}`}
                            className="btn-secondary py-2.5 px-3"
                          >
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeJobs.length === 0 && (
          <div className="card p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-bold text-gray-900 mb-2">No Active Assignments</h3>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
              Your company hasn't assigned any jobs to you yet. Make sure you're online so they know you're available.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
