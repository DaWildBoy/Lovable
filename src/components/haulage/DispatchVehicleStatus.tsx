import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Truck, CheckCircle, Clock, Wrench, ArrowRight } from 'lucide-react';
import { Database } from '../../lib/database.types';

type HaulageVehicle = Database['public']['Tables']['haulage_vehicles']['Row'];

interface VehicleWithStatus extends HaulageVehicle {
  currentStatus: 'in_use' | 'idle' | 'inactive';
  currentJobPickup?: string;
  currentJobDropoff?: string;
}

interface DispatchVehicleStatusProps {
  onNavigate: (path: string) => void;
}

export function DispatchVehicleStatus({ onNavigate }: DispatchVehicleStatusProps) {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<VehicleWithStatus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.id) return;
    fetchVehicleStatus();
  }, [profile?.id]);

  const fetchVehicleStatus = async () => {
    try {
      const [vehiclesRes, activeJobsRes] = await Promise.all([
        supabase
          .from('haulage_vehicles')
          .select('*')
          .eq('company_id', profile!.id)
          .order('vehicle_name'),
        supabase
          .from('jobs')
          .select('assigned_vehicle_id, pickup_location_text, dropoff_location_text')
          .eq('assigned_company_id', profile!.id)
          .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit'])
          .not('assigned_vehicle_id', 'is', null)
      ]);

      if (vehiclesRes.error) throw vehiclesRes.error;
      if (activeJobsRes.error) throw activeJobsRes.error;

      const busyVehicleMap = new Map<string, { pickup: string; dropoff: string }>();
      (activeJobsRes.data || []).forEach(j => {
        if (j.assigned_vehicle_id) {
          busyVehicleMap.set(j.assigned_vehicle_id, {
            pickup: j.pickup_location_text || '',
            dropoff: j.dropoff_location_text || ''
          });
        }
      });

      const withStatus: VehicleWithStatus[] = (vehiclesRes.data || []).map(v => {
        const jobInfo = busyVehicleMap.get(v.id);
        return {
          ...v,
          currentStatus: !v.is_active ? 'inactive' : jobInfo ? 'in_use' : 'idle',
          currentJobPickup: jobInfo?.pickup,
          currentJobDropoff: jobInfo?.dropoff
        };
      });

      setVehicles(withStatus);
    } catch (err) {
      console.error('Error fetching vehicle status:', err);
    } finally {
      setLoading(false);
    }
  };

  const inUse = vehicles.filter(v => v.currentStatus === 'in_use').length;
  const idle = vehicles.filter(v => v.currentStatus === 'idle').length;
  const inactive = vehicles.filter(v => v.currentStatus === 'inactive').length;
  const total = vehicles.length;

  if (loading) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 bg-gray-200 rounded-lg" />
          <div className="h-4 bg-gray-200 rounded w-36" />
        </div>
        <div className="h-3 bg-gray-200 rounded-full w-full mb-3" />
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Truck className="w-5 h-5 text-gray-600" />
          <h3 className="text-sm font-semibold text-gray-900">Vehicle Status</h3>
        </div>
        <div className="text-center py-4">
          <Truck className="w-10 h-10 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No vehicles registered</p>
          <button
            onClick={() => onNavigate('/business/profile?tab=fleet')}
            className="text-xs text-moveme-blue-600 font-medium mt-2 hover:text-moveme-blue-700"
          >
            Add vehicles
          </button>
        </div>
      </div>
    );
  }

  const inUsePercent = total > 0 ? (inUse / total) * 100 : 0;
  const idlePercent = total > 0 ? (idle / total) * 100 : 0;

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Truck className="w-5 h-5 text-moveme-blue-600" />
          <h3 className="text-sm font-semibold text-gray-900">Vehicle Status</h3>
        </div>
        <button
          onClick={() => onNavigate('/business/profile?tab=fleet')}
          className="text-xs text-moveme-blue-600 hover:text-moveme-blue-700 font-medium flex items-center gap-1"
        >
          Manage
          <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden flex mb-3">
        {inUsePercent > 0 && (
          <div
            className="bg-success-500 h-full transition-all duration-500"
            style={{ width: `${inUsePercent}%` }}
          />
        )}
        {idlePercent > 0 && (
          <div
            className="bg-moveme-blue-300 h-full transition-all duration-500"
            style={{ width: `${idlePercent}%` }}
          />
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center mb-4">
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-success-500" />
          <span className="text-xs text-gray-600">{inUse} In Use</span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-moveme-blue-300" />
          <span className="text-xs text-gray-600">{idle} Idle</span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-300" />
          <span className="text-xs text-gray-600">{inactive} Off</span>
        </div>
      </div>

      {vehicles.filter(v => v.currentStatus === 'in_use').length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Currently Deployed</p>
          {vehicles.filter(v => v.currentStatus === 'in_use').map(v => (
            <div key={v.id} className="flex items-center gap-3 bg-success-50 rounded-xl p-2.5 border border-success-100">
              <div className="w-7 h-7 bg-success-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-3.5 h-3.5 text-success-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">{v.vehicle_name}</p>
                <p className="text-[10px] text-gray-500 truncate">{v.plate_number} - {v.currentJobDropoff}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {vehicles.filter(v => v.currentStatus === 'idle').length > 0 && (
        <div className="space-y-2 mt-3">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Available</p>
          <div className="flex flex-wrap gap-1.5">
            {vehicles.filter(v => v.currentStatus === 'idle').map(v => (
              <span key={v.id} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                {v.vehicle_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
