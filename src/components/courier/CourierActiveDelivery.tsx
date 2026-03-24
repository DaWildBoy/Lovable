import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { Truck, MapPin, Navigation, Phone, MessageSquare, RotateCcw, ChevronRight, Clock } from 'lucide-react';

type Job = Database['public']['Tables']['jobs']['Row'];

interface CustomerInfo {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
}

interface ActiveJob extends Job {
  customer?: CustomerInfo;
}

interface Props {
  courierId: string;
  userId: string;
  onNavigate: (path: string) => void;
}

const STATUS_STEPS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'on_way_to_pickup', label: 'En Route' },
  { key: 'arrived_waiting', label: 'Arrived' },
  { key: 'loading_cargo', label: 'Loading' },
  { key: 'cargo_collected', label: 'Collected' },
  { key: 'in_transit', label: 'In Transit' },
];

const ACTIVE_STATUSES = ['assigned', 'queued_next', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'returning'];

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

export function CourierActiveDelivery({ courierId, userId, onNavigate }: Props) {
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveJobs();
  }, [courierId]);

  const fetchActiveJobs = async () => {
    try {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('assigned_courier_id', courierId)
        .in('status', ACTIVE_STATUSES)
        .order('updated_at', { ascending: false });

      if (!jobs || jobs.length === 0) {
        setActiveJobs([]);
        return;
      }

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

      setActiveJobs(jobs.map(job => ({
        ...job,
        customer: customerMap[job.customer_user_id],
      })));
    } catch (error) {
      console.error('Error fetching active deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || activeJobs.length === 0) return null;

  return (
    <div className="space-y-3">
      {activeJobs.map(job => {
        const isReturning = job.status === 'returning';
        const isQueued = job.status === 'queued_next';
        const stepIndex = getStepIndex(job.status || 'assigned');
        const customerName = job.customer
          ? `${job.customer.first_name || ''} ${job.customer.last_name || ''}`.trim() || 'Customer'
          : 'Customer';
        const returnDestination = job.pickup_location_text || 'Original pickup point';
        const progressPercent = isReturning ? 100 : isQueued ? 0 : Math.round(((stepIndex + 1) / STATUS_STEPS.length) * 100);

        if (isQueued) {
          return (
            <div
              key={job.id}
              className="bg-white rounded-2xl border border-amber-200 shadow-card overflow-hidden animate-fade-in-up"
            >
              <div className="px-4 py-3 flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Queued - Up Next</p>
                    <p className="text-[11px] text-white/70">For {customerName}</p>
                  </div>
                </div>
                <span className="text-[11px] font-bold text-white bg-white/20 rounded-full px-2.5 py-1 backdrop-blur-sm">Waiting</span>
              </div>
              <div className="px-4 py-3.5">
                <div className="bg-amber-50 rounded-xl p-3 mb-3 border border-amber-100">
                  <p className="text-xs font-semibold text-amber-800">Complete your current delivery first</p>
                  <p className="text-[10px] text-amber-600 mt-0.5">This job will auto-start once your active delivery is done.</p>
                </div>
                <div className="space-y-1 mb-3">
                  <div className="flex items-center gap-2.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 flex-shrink-0" />
                    <span className="text-gray-700 truncate font-medium">{job.pickup_location_text}</span>
                  </div>
                  <div className="ml-[3px] border-l border-dashed border-gray-200 h-2.5" />
                  <div className="flex items-center gap-2.5 text-xs">
                    <div className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-100 flex-shrink-0" />
                    <span className="text-gray-700 truncate font-medium">{job.dropoff_location_text}</span>
                  </div>
                </div>
                <button
                  onClick={() => onNavigate(`/job/${job.id}`)}
                  className="w-full py-2.5 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white transition-all duration-200 active:scale-[0.97]"
                >
                  View Details
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
              </div>
            </div>
          );
        }

        return (
          <div
            key={job.id}
            className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden animate-fade-in-up"
          >
            <div className={`px-4 py-3 flex items-center justify-between ${
              isReturning
                ? 'bg-gradient-to-r from-red-500 to-red-600'
                : 'bg-gradient-to-r from-emerald-500 to-green-600'
            }`}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                  {isReturning ? (
                    <RotateCcw className="w-4 h-4 text-white" />
                  ) : (
                    <Truck className="w-4 h-4 text-white" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-white">
                    {isReturning ? 'Return Trip' : 'Active Delivery'}
                  </p>
                  <p className="text-[11px] text-white/70">
                    {isReturning ? 'Return to pickup location' : `For ${customerName}`}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 bg-white/20 rounded-full px-2.5 py-1 backdrop-blur-sm">
                <span className="text-[11px] font-bold text-white">{progressPercent}%</span>
              </div>
            </div>

            <div className="px-4 py-3.5">
              {isReturning ? (
                <div className="bg-red-50 rounded-xl p-3 mb-3 flex items-center gap-2.5">
                  <MapPin className="w-4 h-4 text-red-500 flex-shrink-0" />
                  <div>
                    <p className="text-[10px] font-semibold text-red-600 uppercase tracking-wider">Return to</p>
                    <p className="text-sm text-gray-800 font-medium">{returnDestination}</p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1 mb-3">
                    {STATUS_STEPS.map((step, i) => (
                      <div key={step.key} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                            i <= stepIndex
                              ? 'bg-emerald-500'
                              : 'bg-gray-200'
                          } ${i === stepIndex ? 'ring-[3px] ring-emerald-100 scale-125' : ''}`} />
                          <p className={`text-[8px] mt-1 text-center leading-tight font-medium ${
                            i <= stepIndex ? 'text-emerald-600' : 'text-gray-400'
                          }`}>
                            {step.label}
                          </p>
                        </div>
                        {i < STATUS_STEPS.length - 1 && (
                          <div className={`h-[2px] flex-1 -mt-3 mx-0.5 rounded-full transition-colors duration-300 ${
                            i < stepIndex ? 'bg-emerald-400' : 'bg-gray-200'
                          }`} />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-1 mb-3">
                    <div className="flex items-center gap-2.5 text-xs">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 flex-shrink-0" />
                      <span className="text-gray-700 truncate font-medium">{job.pickup_location_text}</span>
                    </div>
                    <div className="ml-[3px] border-l border-dashed border-gray-200 h-2.5" />
                    <div className="flex items-center gap-2.5 text-xs">
                      <div className="w-2 h-2 rounded-full bg-red-500 ring-2 ring-red-100 flex-shrink-0" />
                      <span className="text-gray-700 truncate font-medium">{job.dropoff_location_text}</span>
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => onNavigate(`/job/${job.id}`)}
                  className={`flex-1 py-2.5 text-xs rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all duration-200 active:scale-[0.97] ${
                    isReturning
                      ? 'bg-red-600 hover:bg-red-700 text-white shadow-sm'
                      : 'bg-moveme-blue-600 hover:bg-moveme-blue-700 text-white shadow-sm'
                  }`}
                >
                  <Navigation className="w-3.5 h-3.5" />
                  {isReturning ? 'Navigate Return' : 'View / Navigate'}
                  <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                </button>
                <button
                  onClick={() => onNavigate('/courier/messages')}
                  className="w-11 h-11 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-gray-600" />
                </button>
                {job.customer?.phone && (
                  <a
                    href={`tel:${job.customer.phone}`}
                    className="w-11 h-11 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl flex items-center justify-center transition-colors"
                  >
                    <Phone className="w-4 h-4 text-gray-600" />
                  </a>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
