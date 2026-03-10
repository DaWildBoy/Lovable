import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Database } from '../../lib/database.types';
import { Truck, MapPin, Navigation, Phone, Car, PackageCheck } from 'lucide-react';
import { formatMinutesToHoursMinutes } from '../../lib/timeUtils';

type Job = Database['public']['Tables']['jobs']['Row'];

interface CourierInfo {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface VehicleInfo {
  vehicle_type: string | null;
  vehicle_make: string | null;
  vehicle_model: string | null;
  vehicle_plate: string | null;
}

interface ActiveJob extends Job {
  courier?: CourierInfo;
  vehicle?: VehicleInfo;
}

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

const ACTIVE_STATUSES = ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit'];

const STATUS_STEPS = [
  { key: 'assigned', label: 'Assigned' },
  { key: 'on_way_to_pickup', label: 'En Route' },
  { key: 'arrived_waiting', label: 'Arrived' },
  { key: 'loading_cargo', label: 'Loading' },
  { key: 'cargo_collected', label: 'Collected' },
  { key: 'in_transit', label: 'In Transit' },
];

function getStepIndex(status: string): number {
  const idx = STATUS_STEPS.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

export function ActiveDeliveryTracker({ userId, onNavigate }: Props) {
  const [activeJobs, setActiveJobs] = useState<ActiveJob[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActiveJobs();
  }, [userId]);

  const fetchActiveJobs = async () => {
    try {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('*')
        .eq('customer_user_id', userId)
        .in('status', ACTIVE_STATUSES)
        .order('updated_at', { ascending: false });

      if (!jobs || jobs.length === 0) {
        setActiveJobs([]);
        return;
      }

      const courierIds = jobs
        .map(j => j.assigned_courier_id)
        .filter((id): id is string => !!id);

      let courierMap: Record<string, CourierInfo> = {};
      let vehicleMap: Record<string, VehicleInfo> = {};

      if (courierIds.length > 0) {
        const [profilesRes, couriersRes] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, first_name, last_name, phone, avatar_url')
            .in('id', courierIds),
          supabase
            .from('couriers')
            .select('user_id, vehicle_type, vehicle_make, vehicle_model, vehicle_plate')
            .in('user_id', courierIds),
        ]);

        if (profilesRes.data) {
          courierMap = Object.fromEntries(profilesRes.data.map(c => [c.id, c]));
        }
        if (couriersRes.data) {
          vehicleMap = Object.fromEntries(couriersRes.data.map(v => [v.user_id, v]));
        }
      }

      setActiveJobs(jobs.map(job => ({
        ...job,
        courier: job.assigned_courier_id ? courierMap[job.assigned_courier_id] : undefined,
        vehicle: job.assigned_courier_id ? vehicleMap[job.assigned_courier_id] : undefined,
      })));
    } catch (error) {
      console.error('Error fetching active deliveries:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || activeJobs.length === 0) return null;

  return (
    <div className="space-y-3 mb-5">
      {activeJobs.map(job => {
        const stepIndex = getStepIndex(job.status || 'assigned');
        const courierName = job.courier
          ? `${job.courier.first_name || ''} ${job.courier.last_name || ''}`.trim()
          : job.assigned_driver_name || 'Courier';

        const vehicleLabel = job.vehicle
          ? [job.vehicle.vehicle_make, job.vehicle.vehicle_model].filter(Boolean).join(' ')
          : job.assigned_vehicle_label || null;

        return (
          <div
            key={job.id}
            className="card overflow-hidden border-l-4 border-l-moveme-blue-500"
          >
            <div className="bg-gradient-to-r from-moveme-blue-50/80 to-white px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-moveme-blue-100 rounded-xl flex items-center justify-center">
                  <Truck className="w-4.5 h-4.5 text-moveme-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">Delivery in Progress</p>
                  <p className="text-xs text-gray-500">{courierName}</p>
                </div>
              </div>
              {job.eta_minutes && (
                <div className="text-right">
                  <p className="text-lg font-bold text-moveme-blue-600">{formatMinutesToHoursMinutes(job.eta_minutes)}</p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wide">ETA</p>
                </div>
              )}
            </div>

            <div className="px-4 py-3">
              {vehicleLabel && (
                <div className="flex items-center gap-2 mb-3 px-2.5 py-1.5 bg-gray-50 rounded-lg">
                  <Car className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs text-gray-600 font-medium">{vehicleLabel}</span>
                  {job.vehicle?.vehicle_plate && (
                    <span className="ml-auto text-[10px] bg-white border border-gray-200 rounded px-1.5 py-0.5 font-mono font-bold text-gray-700">
                      {job.vehicle.vehicle_plate}
                    </span>
                  )}
                </div>
              )}

              <div className="flex items-center gap-1 mb-3">
                {STATUS_STEPS.map((step, i) => (
                  <div key={step.key} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      <div
                        className={`w-3 h-3 rounded-full transition-all ${
                          i <= stepIndex
                            ? 'bg-moveme-blue-500 shadow-sm shadow-moveme-blue-200'
                            : 'bg-gray-200'
                        }`}
                      />
                      <p className={`text-[9px] mt-1 text-center leading-tight ${
                        i <= stepIndex ? 'text-moveme-blue-600 font-semibold' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </p>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 -mt-3 mx-0.5 ${
                        i < stepIndex ? 'bg-moveme-blue-400' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>

              {job.status === 'loading_cargo' && (
                <div className="flex items-center gap-2 mb-3 px-2.5 py-2 bg-teal-50 border border-teal-200 rounded-lg">
                  <PackageCheck className="w-4 h-4 text-teal-600 animate-pulse" />
                  <span className="text-xs font-semibold text-teal-800">Driver is loading your cargo</span>
                </div>
              )}
              {job.status === 'arrived_waiting' && (
                <div className="flex items-center gap-2 mb-3 px-2.5 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <MapPin className="w-4 h-4 text-amber-600 animate-pulse" />
                  <span className="text-xs font-semibold text-amber-800">Driver has arrived at pickup -- please meet them</span>
                </div>
              )}

              <div className="flex items-start gap-2 text-xs text-gray-600 mb-3">
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-success-500 flex-shrink-0 mt-0.5" />
                  <span className="truncate">{job.pickup_location_text}</span>
                </div>
                <Navigation className="w-3 h-3 text-gray-300 flex-shrink-0 mt-0.5" />
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-error-500 flex-shrink-0 mt-0.5" />
                  <span className="truncate">{job.dropoff_location_text}</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => onNavigate(`/job/${job.id}`)}
                  className="flex-1 btn-primary py-2.5 text-xs"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Track Delivery
                </button>
                {job.courier?.phone && (
                  <a
                    href={`tel:${job.courier.phone}`}
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
  );
}
