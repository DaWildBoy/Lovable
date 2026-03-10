import { useState, useEffect } from 'react';
import { Users, Truck, AlertCircle, Check, X, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  license_type: string | null;
  activeJobCount?: number;
}

interface Vehicle {
  id: string;
  vehicle_name: string;
  plate_number: string | null;
  vehicle_type: string;
  capacity_kg: number | null;
  activeJobCount?: number;
}

interface AssignDriverVehicleModalProps {
  jobId: string;
  onAssign: (driverId: string, vehicleId: string) => Promise<void>;
  onCancel: () => void;
}

export function AssignDriverVehicleModal({
  jobId,
  onAssign,
  onCancel,
}: AssignDriverVehicleModalProps) {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResources();
  }, [profile]);

  const fetchResources = async () => {
    if (!profile) return;

    try {
      const [driversResult, vehiclesResult, activeJobsResult] = await Promise.all([
        supabase
          .from('haulage_drivers')
          .select('id, full_name, phone, license_type')
          .eq('company_id', profile.id)
          .eq('is_active', true)
          .order('full_name'),
        supabase
          .from('haulage_vehicles')
          .select('id, vehicle_name, plate_number, vehicle_type, capacity_kg')
          .eq('company_id', profile.id)
          .eq('is_active', true)
          .order('vehicle_name'),
        supabase
          .from('jobs')
          .select('assigned_driver_id, assigned_vehicle_id')
          .eq('assigned_company_id', profile.id)
          .in('status', ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit']),
      ]);

      if (driversResult.error) throw driversResult.error;
      if (vehiclesResult.error) throw vehiclesResult.error;

      const activeJobs = activeJobsResult.data || [];
      const driverJobCounts = new Map<string, number>();
      const vehicleJobCounts = new Map<string, number>();

      for (const job of activeJobs) {
        if (job.assigned_driver_id) {
          driverJobCounts.set(job.assigned_driver_id, (driverJobCounts.get(job.assigned_driver_id) || 0) + 1);
        }
        if (job.assigned_vehicle_id) {
          vehicleJobCounts.set(job.assigned_vehicle_id, (vehicleJobCounts.get(job.assigned_vehicle_id) || 0) + 1);
        }
      }

      setDrivers((driversResult.data || []).map(d => ({
        ...d,
        activeJobCount: driverJobCounts.get(d.id) || 0,
      })));
      setVehicles((vehiclesResult.data || []).map(v => ({
        ...v,
        activeJobCount: vehicleJobCounts.get(v.id) || 0,
      })));
    } catch (error) {
      console.error('Error fetching resources:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedDriverId || !selectedVehicleId) {
      setError('Please select both a driver and a vehicle');
      return;
    }

    setAssigning(true);
    setError(null);
    try {
      await onAssign(selectedDriverId, selectedVehicleId);
    } catch (error) {
      console.error('Error assigning resources:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setAssigning(false);
    }
  };

  const selectedDriver = drivers.find(d => d.id === selectedDriverId);
  const selectedVehicle = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-xl font-semibold text-gray-900">Assign Driver & Vehicle</h3>
          <p className="text-sm text-gray-600 mt-1">
            Select a driver and vehicle for this delivery
          </p>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-800 mb-1">Assignment Error</p>
                <p className="text-sm text-red-700">{error}</p>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading resources...</div>
          ) : (
            <>
              {drivers.length === 0 || vehicles.length === 0 ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-red-800 mb-1">
                      Cannot Accept Job
                    </p>
                    <p className="text-sm text-red-700">
                      {drivers.length === 0 && vehicles.length === 0
                        ? 'You must add at least one driver and one vehicle before accepting jobs.'
                        : drivers.length === 0
                        ? 'You must add at least one driver before accepting jobs.'
                        : 'You must add at least one vehicle before accepting jobs.'}
                    </p>
                    <p className="text-sm text-red-700 mt-2">
                      Go to your profile to add drivers and vehicles to your fleet.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-5 h-5 text-green-600" />
                      <label className="text-sm font-semibold text-gray-900">
                        Select Driver *
                      </label>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {drivers.map((driver) => {
                        const isBusy = (driver.activeJobCount || 0) > 0;
                        return (
                          <label
                            key={driver.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedDriverId === driver.id
                                ? 'border-green-500 bg-green-50'
                                : isBusy
                                ? 'border-amber-200 hover:border-amber-400 hover:bg-amber-50/50'
                                : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="driver"
                              value={driver.id}
                              checked={selectedDriverId === driver.id}
                              onChange={() => setSelectedDriverId(driver.id)}
                              className="w-4 h-4 text-green-600 border-gray-300 focus:ring-green-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{driver.full_name}</p>
                                {isBusy && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                                    <Clock className="w-3 h-3" />
                                    {driver.activeJobCount} active {driver.activeJobCount === 1 ? 'job' : 'jobs'}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                {driver.phone && <span>Phone: {driver.phone}</span>}
                                {driver.license_type && (
                                  <span className="ml-3">License: {driver.license_type}</span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Truck className="w-5 h-5 text-orange-600" />
                      <label className="text-sm font-semibold text-gray-900">
                        Select Vehicle *
                      </label>
                    </div>
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2">
                      {vehicles.map((vehicle) => {
                        const isBusy = (vehicle.activeJobCount || 0) > 0;
                        return (
                          <label
                            key={vehicle.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                              selectedVehicleId === vehicle.id
                                ? 'border-orange-500 bg-orange-50'
                                : isBusy
                                ? 'border-amber-200 hover:border-amber-400 hover:bg-amber-50/50'
                                : 'border-gray-200 hover:border-orange-300 hover:bg-gray-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name="vehicle"
                              value={vehicle.id}
                              checked={selectedVehicleId === vehicle.id}
                              onChange={() => setSelectedVehicleId(vehicle.id)}
                              className="w-4 h-4 text-orange-600 border-gray-300 focus:ring-orange-500"
                            />
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900">{vehicle.vehicle_name}</p>
                                {isBusy && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                                    <Clock className="w-3 h-3" />
                                    {vehicle.activeJobCount} active {vehicle.activeJobCount === 1 ? 'job' : 'jobs'}
                                  </span>
                                )}
                              </div>
                              <div className="text-sm text-gray-600">
                                <span>{vehicle.vehicle_type}</span>
                                {vehicle.plate_number && (
                                  <span className="ml-3">Plate: {vehicle.plate_number}</span>
                                )}
                                {vehicle.capacity_kg && (
                                  <span className="ml-3">Capacity: {vehicle.capacity_kg} kg</span>
                                )}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {selectedDriver && selectedVehicle && (
                    <div className="space-y-3">
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm font-semibold text-blue-900 mb-2">Assignment Summary</p>
                        <div className="text-sm text-blue-800 space-y-1">
                          <div>Driver: <span className="font-medium">{selectedDriver.full_name}</span></div>
                          <div>Vehicle: <span className="font-medium">{selectedVehicle.vehicle_name} ({selectedVehicle.vehicle_type})</span></div>
                        </div>
                      </div>
                      {((selectedDriver.activeJobCount || 0) > 0 || (selectedVehicle.activeJobCount || 0) > 0) && (
                        <div className="p-4 bg-amber-50 border border-amber-300 rounded-lg flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-sm text-amber-800">
                            <p className="font-semibold mb-1">Scheduling Notice</p>
                            {(selectedDriver.activeJobCount || 0) > 0 && (
                              <p>{selectedDriver.full_name} currently has {selectedDriver.activeJobCount} active {selectedDriver.activeJobCount === 1 ? 'job' : 'jobs'}.</p>
                            )}
                            {(selectedVehicle.activeJobCount || 0) > 0 && (
                              <p>{selectedVehicle.vehicle_name} is currently assigned to {selectedVehicle.activeJobCount} active {selectedVehicle.activeJobCount === 1 ? 'job' : 'jobs'}.</p>
                            )}
                            <p className="mt-1 text-amber-700">You can still assign this job. The driver will handle it after completing current work.</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          {drivers.length > 0 && vehicles.length > 0 ? (
            <>
              <button
                onClick={handleAssign}
                disabled={!selectedDriverId || !selectedVehicleId || assigning}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Check className="w-4 h-4" />
                {assigning ? 'Assigning...' : 'Assign & Accept Job'}
              </button>
              <button
                onClick={onCancel}
                disabled={assigning}
                className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={onCancel}
              className="w-full py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
