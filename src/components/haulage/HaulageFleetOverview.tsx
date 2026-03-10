import { useState, useEffect } from 'react';
import { Box, Scale, Truck, Users, Plus, Edit2, Trash2, Check, X, Copy } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Vehicle {
  id: string;
  vehicle_name: string;
  plate_number: string | null;
  vehicle_type: string;
  capacity_kg: number | null;
  special_equipment: string | null;
  is_active: boolean;
}

interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  license_type: string | null;
  is_active: boolean;
}

interface FleetStats {
  totalVehicles: number;
  activeVehicles: number;
  vehicleTypes: Record<string, number>;
  totalDrivers: number;
  activeDrivers: number;
  maxCapacityKg: number;
  avgCapacityKg: number;
  specialEquipment: string[];
}

export function HaulageFleetOverview() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<FleetStats>({
    totalVehicles: 0,
    activeVehicles: 0,
    vehicleTypes: {},
    totalDrivers: 0,
    activeDrivers: 0,
    maxCapacityKg: 0,
    avgCapacityKg: 0,
    specialEquipment: [],
  });
  const [loading, setLoading] = useState(true);

  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    vehicle_name: '',
    plate_number: '',
    vehicle_type: '',
    capacity_kg: '',
    special_equipment: '',
    is_active: true,
  });

  const [showDriverCodeModal, setShowDriverCodeModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    fetchFleetData();
  }, [profile]);

  const fetchFleetData = async () => {
    if (!profile) return;

    try {
      const [vehiclesResult, driversResult] = await Promise.all([
        supabase
          .from('haulage_vehicles')
          .select('*')
          .eq('company_id', profile.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('haulage_drivers')
          .select('*')
          .eq('company_id', profile.id)
          .order('created_at', { ascending: false }),
      ]);

      if (vehiclesResult.error) throw vehiclesResult.error;
      if (driversResult.error) throw driversResult.error;

      const vehicleData = vehiclesResult.data || [];
      const driverData = driversResult.data || [];

      setVehicles(vehicleData.filter(v => v.is_active));
      setDrivers(driverData.filter(d => d.is_active));

      const vehicleTypes: Record<string, number> = {};
      const equipment = new Set<string>();
      let totalCapacity = 0;
      let capacityCount = 0;
      let maxCapacity = 0;

      vehicleData.forEach((v) => {
        vehicleTypes[v.vehicle_type] = (vehicleTypes[v.vehicle_type] || 0) + 1;

        if (v.capacity_kg) {
          totalCapacity += v.capacity_kg;
          capacityCount++;
          maxCapacity = Math.max(maxCapacity, v.capacity_kg);
        }

        if (v.special_equipment) {
          v.special_equipment.split(',').forEach((eq: string) => equipment.add(eq.trim()));
        }
      });

      setStats({
        totalVehicles: vehicleData.length,
        activeVehicles: vehicleData.filter(v => v.is_active).length,
        vehicleTypes,
        totalDrivers: driverData.length,
        activeDrivers: driverData.filter(d => d.is_active).length,
        maxCapacityKg: maxCapacity,
        avgCapacityKg: capacityCount > 0 ? totalCapacity / capacityCount : 0,
        specialEquipment: Array.from(equipment),
      });
    } catch (error) {
      console.error('Error fetching fleet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const vehicleTypes = [
    'Box Truck',
    'Flatbed',
    'Reefer (Refrigerated)',
    'Tipper',
    'Lowboy',
    'Tanker',
    'Van',
    'Pickup Truck',
  ];

  const handleAddVehicle = () => {
    setEditingVehicle(null);
    setVehicleFormData({
      vehicle_name: '',
      plate_number: '',
      vehicle_type: '',
      capacity_kg: '',
      special_equipment: '',
      is_active: true,
    });
    setShowVehicleModal(true);
  };

  const handleEditVehicle = (vehicleId: string) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (vehicle) {
      setEditingVehicle(vehicle);
      setVehicleFormData({
        vehicle_name: vehicle.vehicle_name,
        plate_number: vehicle.plate_number || '',
        vehicle_type: vehicle.vehicle_type,
        capacity_kg: vehicle.capacity_kg?.toString() || '',
        special_equipment: vehicle.special_equipment || '',
        is_active: vehicle.is_active,
      });
      setShowVehicleModal(true);
    }
  };

  const handleSaveVehicle = async () => {
    if (!profile) return;

    try {
      if (editingVehicle) {
        const { error } = await supabase
          .from('haulage_vehicles')
          .update({
            vehicle_name: vehicleFormData.vehicle_name,
            plate_number: vehicleFormData.plate_number || null,
            vehicle_type: vehicleFormData.vehicle_type,
            capacity_kg: vehicleFormData.capacity_kg ? parseFloat(vehicleFormData.capacity_kg) : null,
            special_equipment: vehicleFormData.special_equipment || null,
            is_active: vehicleFormData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingVehicle.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('haulage_vehicles')
          .insert({
            company_id: profile.id,
            vehicle_name: vehicleFormData.vehicle_name,
            plate_number: vehicleFormData.plate_number || null,
            vehicle_type: vehicleFormData.vehicle_type,
            capacity_kg: vehicleFormData.capacity_kg ? parseFloat(vehicleFormData.capacity_kg) : null,
            special_equipment: vehicleFormData.special_equipment || null,
            is_active: vehicleFormData.is_active,
          });

        if (error) throw error;
      }

      await fetchFleetData();
      setShowVehicleModal(false);
      setEditingVehicle(null);
    } catch (error) {
      console.error('Error saving vehicle:', error);
      alert('Failed to save vehicle');
    }
  };

  const handleDeleteVehicle = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;

    try {
      const { error } = await supabase
        .from('haulage_vehicles')
        .delete()
        .eq('id', vehicleId);

      if (error) throw error;
      await fetchFleetData();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('Failed to delete vehicle');
    }
  };

  const handleCopyCode = async () => {
    const code = profile?.haulage_company_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleDeleteDriver = async (driverId: string) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    try {
      const { error } = await supabase
        .from('haulage_drivers')
        .delete()
        .eq('id', driverId);

      if (error) throw error;
      await fetchFleetData();
    } catch (error) {
      console.error('Error deleting driver:', error);
      alert('Failed to delete driver');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-gray-500">Loading fleet overview...</div>
      </div>
    );
  }

  return (
    <>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Fleet Resources Card - Blue */}
      <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Box className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-medium text-blue-700">Fleet Composition</span>
        </div>
        <div className="text-2xl font-bold text-blue-900 mb-1">
          {stats.activeVehicles} Vehicles
        </div>
        <p className="text-xs text-blue-600 mb-3">of {stats.totalVehicles} total</p>

        {Object.keys(stats.vehicleTypes).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {Object.entries(stats.vehicleTypes).map(([type, count]) => (
              <span
                key={type}
                className="px-2 py-0.5 bg-white text-blue-700 text-xs font-medium rounded-full border border-blue-200"
              >
                {type}: {count}
              </span>
            ))}
          </div>
        )}

        {stats.specialEquipment.length > 0 && (
          <div className="text-xs text-blue-700">
            <span className="font-semibold">Special Equipment:</span> {stats.specialEquipment.join(', ')}
          </div>
        )}
      </div>

      {/* Capacity Metrics Card - Green */}
      <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
            <Scale className="w-4 h-4 text-white" />
          </div>
          <span className="text-xs font-medium text-green-700">Load Capabilities</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-2xl font-bold text-green-900">{Math.round(stats.maxCapacityKg)}</div>
            <p className="text-xs text-green-600">Max Capacity (kg)</p>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-900">{Math.round(stats.avgCapacityKg)}</div>
            <p className="text-xs text-green-600">Avg Capacity (kg)</p>
          </div>
        </div>
      </div>

      {/* Vehicle Roster Card - Indigo */}
      <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-4 border border-indigo-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-indigo-700">Vehicle Roster</span>
          </div>
          <button
            onClick={handleAddVehicle}
            className="flex items-center gap-1 px-2 py-1 bg-indigo-600 text-white text-xs rounded-lg hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        {vehicles.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="bg-white rounded-lg p-2 border border-indigo-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h4 className="text-sm font-semibold text-indigo-900 truncate">{vehicle.vehicle_name}</h4>
                      <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded whitespace-nowrap">
                        {vehicle.vehicle_type}
                      </span>
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded whitespace-nowrap">
                        Active
                      </span>
                    </div>
                    <div className="text-xs text-indigo-700 space-y-0.5">
                      {vehicle.plate_number && <div>Plate: {vehicle.plate_number}</div>}
                      {vehicle.capacity_kg && <div>Cap: {vehicle.capacity_kg} kg</div>}
                      {vehicle.special_equipment && <div>Equip: {vehicle.special_equipment}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => handleEditVehicle(vehicle.id)}
                      className="p-1 text-indigo-600 hover:bg-indigo-100 rounded transition-all"
                    >
                      <Edit2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => handleDeleteVehicle(vehicle.id)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Truck className="w-8 h-8 text-indigo-300 mx-auto mb-2" />
            <p className="text-xs text-indigo-600">No vehicles added yet</p>
          </div>
        )}
      </div>

      {/* Driver Roster Card - Orange */}
      <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <span className="text-xs font-medium text-orange-700">Driver Roster</span>
          </div>
          <button
            onClick={() => setShowDriverCodeModal(true)}
            className="flex items-center gap-1 px-2 py-1 bg-orange-600 text-white text-xs rounded-lg hover:bg-orange-700 transition-all"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </div>

        <div className="text-2xl font-bold text-orange-900 mb-1">
          {stats.activeDrivers} Drivers
        </div>
        <p className="text-xs text-orange-600 mb-3">of {stats.totalDrivers} total</p>

        {drivers.length > 0 ? (
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {drivers.map((driver) => (
              <div
                key={driver.id}
                className="bg-white rounded-lg p-2 border border-orange-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <h4 className="text-sm font-semibold text-orange-900 truncate">{driver.full_name}</h4>
                      <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded whitespace-nowrap">
                        Active
                      </span>
                    </div>
                    <div className="text-xs text-orange-700 space-y-0.5">
                      {driver.phone && <div>Phone: {driver.phone}</div>}
                      {driver.license_type && <div>License: {driver.license_type}</div>}
                    </div>
                  </div>
                  <div className="flex gap-1 ml-2">
                    <button
                      onClick={() => handleDeleteDriver(driver.id)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-all"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6">
            <Users className="w-8 h-8 text-orange-300 mx-auto mb-2" />
            <p className="text-xs text-orange-600">No drivers added yet</p>
          </div>
        )}
      </div>
    </div>

    {/* Vehicle Modal */}
    {showVehicleModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-xl font-semibold text-gray-900">
              {editingVehicle ? 'Edit Vehicle' : 'Add New Vehicle'}
            </h3>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Name / Unit Number *
              </label>
              <input
                type="text"
                value={vehicleFormData.vehicle_name}
                onChange={(e) => setVehicleFormData({ ...vehicleFormData, vehicle_name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g., Unit 01, Truck A"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Plate Number
              </label>
              <input
                type="text"
                value={vehicleFormData.plate_number}
                onChange={(e) => setVehicleFormData({ ...vehicleFormData, plate_number: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Enter plate number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Type *
              </label>
              <select
                value={vehicleFormData.vehicle_type}
                onChange={(e) => setVehicleFormData({ ...vehicleFormData, vehicle_type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">Select vehicle type</option>
                {vehicleTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Capacity (kg)
              </label>
              <input
                type="number"
                value={vehicleFormData.capacity_kg}
                onChange={(e) => setVehicleFormData({ ...vehicleFormData, capacity_kg: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Max payload in kg"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Special Equipment
              </label>
              <input
                type="text"
                value={vehicleFormData.special_equipment}
                onChange={(e) => setVehicleFormData({ ...vehicleFormData, special_equipment: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="e.g., Liftgate, Crane, Straps"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="vehicle_active"
                checked={vehicleFormData.is_active}
                onChange={(e) => setVehicleFormData({ ...vehicleFormData, is_active: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <label htmlFor="vehicle_active" className="text-sm text-gray-700">
                Vehicle is active
              </label>
            </div>
          </div>

          <div className="p-6 border-t border-gray-200 flex gap-3">
            <button
              onClick={handleSaveVehicle}
              disabled={!vehicleFormData.vehicle_name || !vehicleFormData.vehicle_type}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              <Check className="w-4 h-4" />
              {editingVehicle ? 'Update' : 'Add Vehicle'}
            </button>
            <button
              onClick={() => {
                setShowVehicleModal(false);
                setEditingVehicle(null);
              }}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Driver Code Modal */}
    {showDriverCodeModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Add a Driver</h3>
                <p className="text-xs text-gray-500">Share this code with your driver to get started</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Share the code below with your driver</p>
                  <p className="text-xs text-gray-500 mt-0.5">Send it via WhatsApp, SMS, or in person</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Driver signs up as a courier</p>
                  <p className="text-xs text-gray-500 mt-0.5">They enter this code during their sign-up process</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">Approve the driver from your dashboard</p>
                  <p className="text-xs text-gray-500 mt-0.5">They will appear in Pending Driver Approvals</p>
                </div>
              </div>
            </div>

            {profile?.haulage_company_code ? (
              <div className="bg-slate-800 rounded-xl p-5">
                <p className="text-xs text-slate-400 mb-2 font-medium tracking-wide uppercase">Your Company Code</p>
                <div className="flex items-center justify-between">
                  <p className="text-2xl font-mono font-bold text-white tracking-[0.25em]">
                    {profile.haulage_company_code}
                  </p>
                  <button
                    onClick={handleCopyCode}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      codeCopied
                        ? 'bg-green-500 text-white'
                        : 'bg-slate-600 text-slate-200 hover:bg-slate-500'
                    }`}
                  >
                    {codeCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  This code is single-use. A new code is generated automatically each time a driver links.
                </p>
              </div>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                No company code found. Please check your company profile settings.
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200">
            <button
              onClick={() => {
                setShowDriverCodeModal(false);
                setCodeCopied(false);
              }}
              className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all font-medium"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
