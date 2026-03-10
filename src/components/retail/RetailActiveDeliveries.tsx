import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { Truck, Navigation, MapPin, ChevronRight, RotateCcw } from 'lucide-react';
import { formatMinutesToHoursMinutes } from '../../lib/timeUtils';

type Job = Database['public']['Tables']['jobs']['Row'];

const ACTIVE_STATUSES = ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'returning'];

const STATUS_CONFIG: Record<string, { label: string; color: string; dotColor: string }> = {
  assigned: { label: 'Assigned', color: 'bg-moveme-blue-50 text-moveme-blue-700', dotColor: 'bg-moveme-blue-500' },
  on_way_to_pickup: { label: 'En Route', color: 'bg-warning-50 text-warning-700', dotColor: 'bg-warning-500' },
  cargo_collected: { label: 'Collected', color: 'bg-moveme-teal-50 text-moveme-teal-700', dotColor: 'bg-moveme-teal-500' },
  in_transit: { label: 'In Transit', color: 'bg-success-50 text-success-700', dotColor: 'bg-success-500' },
  returning: { label: 'Returning', color: 'bg-red-50 text-red-700', dotColor: 'bg-red-500' },
};

const RETURN_REASONS: Record<string, string> = {
  customer_refused: 'Customer Refused Item',
  item_does_not_fit: 'Item Does Not Fit',
  wrong_address_unavailable: 'Wrong Address / Unavailable',
  item_damaged: 'Item Damaged',
};

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

export function RetailActiveDeliveries({ userId, onNavigate }: Props) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActive();
  }, [userId]);

  const fetchActive = async () => {
    try {
      const { data } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_user_id', userId)
        .in('status', ACTIVE_STATUSES)
        .order('updated_at', { ascending: false })
        .limit(5);

      setJobs(data || []);
    } catch (error) {
      console.error('Error fetching active deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || jobs.length === 0) return null;

  const returningJobs = jobs.filter(j => j.status === 'returning');
  const activeJobs = jobs.filter(j => j.status !== 'returning');

  return (
    <div className="space-y-3 mb-5">
      {returningJobs.map((job) => {
        const returnReason = RETURN_REASONS[(job as any).return_reason] || 'Delivery Failed';
        const returnFee = Number((job as any).return_fee) || 0;

        return (
          <button
            key={job.id}
            onClick={() => onNavigate(`/job/${job.id}`)}
            className="w-full text-left card overflow-hidden border-2 border-red-200 hover:border-red-300 transition-all active:scale-[0.99]"
          >
            <div className="bg-red-600 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                  <RotateCcw className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white">Delivery Failed - Returning to Base</p>
                  <p className="text-[11px] text-red-100 mt-0.5">{returnReason}</p>
                </div>
              </div>
            </div>
            <div className="bg-red-50 px-4 py-3 space-y-2">
              <p className="text-xs text-red-800 leading-relaxed">
                A <span className="font-bold">50% discounted return rate</span> has been applied and <span className="font-bold">MoveMeTT has waived our platform fees</span> for this return.
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-red-600">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[180px]">
                    {(job as any).original_dropoff_location_text?.split(',')[0] || job.dropoff_location_text?.split(',')[0]}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {returnFee > 0 && (
                    <span className="text-xs font-bold text-red-700">+TTD ${returnFee.toFixed(0)}</span>
                  )}
                  <span className="badge text-[10px] px-2 py-0.5 bg-red-100 text-red-700">Returning</span>
                </div>
              </div>
            </div>
          </button>
        );
      })}

      {activeJobs.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-moveme-blue-50 rounded-xl flex items-center justify-center">
                <Truck className="w-4 h-4 text-moveme-blue-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Active Deliveries</h3>
                <p className="text-[11px] text-gray-400">{activeJobs.length} in progress</p>
              </div>
            </div>
            <button
              onClick={() => onNavigate('/business/jobs?tab=active')}
              className="text-xs font-medium text-moveme-blue-600 hover:text-moveme-blue-700 flex items-center gap-0.5"
            >
              View All
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="px-4 pb-4 space-y-2">
            {activeJobs.map((job) => {
              const config = STATUS_CONFIG[job.status || 'assigned'] || STATUS_CONFIG.assigned;
              return (
                <button
                  key={job.id}
                  onClick={() => onNavigate(`/job/${job.id}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 transition-all active:scale-[0.99] text-left group"
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${config.dotColor}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {job.pickup_location_text?.split(',')[0]}
                      </p>
                      <Navigation className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
                      <p className="text-xs text-gray-500 truncate">
                        {job.dropoff_location_text?.split(',')[0]}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400">
                      <MapPin className="w-2.5 h-2.5" />
                      <span>{job.distance_km} km</span>
                      {job.eta_minutes && (
                        <>
                          <span className="text-gray-200">|</span>
                          <span className="text-moveme-blue-600 font-semibold">ETA {formatMinutesToHoursMinutes(job.eta_minutes)}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <span className={`badge text-[10px] px-2 py-0.5 ${config.color}`}>
                      {config.label}
                    </span>
                    <span className="text-xs font-bold text-gray-700">TTD ${((job as any).customer_total || Math.round((job.customer_offer_ttd || 0) * 1.225 * 100) / 100).toFixed(2)}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
