import { useState, useEffect } from 'react';
import { Truck, Users, Plus, X, Edit2, Trash2, Package, Weight, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Vehicle {
  id: string;
  vehicle_name: string;
  plate_number: string;
  vehicle_type: string;
  capacity_kg: number;
  special_equipment: string;
  is_active: boolean;
  created_at: string;
}

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  license_type: string;
  is_active: boolean;
  created_at: string;
}

interface VehicleFormData {
  vehicle_name: string;
  plate_number: string;
  vehicle_type: string;
  capacity_kg: string;
}

interface DriverFormData {
  full_name: string;
  phone: string;
  license_type: string;
}

export default function FleetOverview() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false);
  const [showAddDriverModal, setShowAddDriverModal] = useState(false);

  const [vehicleForm, setVehicleForm] = useState<VehicleFormData>({
    vehicle_name: '',
    plate_number: '',
    vehicle_type: '',
    capacity_kg: '',
  });

  const [driverForm, setDriverForm] = useState<DriverFormData>({
    full_name: '',
    phone: '',
    license_type: '',
  });

  useEffect(() => {
    if (profile?.id) {
      fetchFleetData();
    }
  }, [profile]);

  const fetchFleetData = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const [vehiclesRes, driversRes] = await Promise.all([
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

      if (vehiclesRes.data) setVehicles(vehiclesRes.data);
      if (driversRes.data) setDrivers(driversRes.data);
    } catch (error) {
      console.error('Error fetching fleet data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('haulage_vehicles')
        .insert([
          {
            company_id: profile.id,
            vehicle_name: vehicleForm.vehicle_name,
            plate_number: vehicleForm.plate_number,
            vehicle_type: vehicleForm.vehicle_type,
            capacity_kg: parseFloat(vehicleForm.capacity_kg) || 0,
            is_active: true,
          },
        ])
        .select();

      if (error) throw error;

      if (data) {
        setVehicles([data[0], ...vehicles]);
        setShowAddVehicleModal(false);
        setVehicleForm({
          vehicle_name: '',
          plate_number: '',
          vehicle_type: '',
          capacity_kg: '',
        });
      }
    } catch (error) {
      console.error('Error adding vehicle:', error);
      alert('Failed to add vehicle');
    }
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;

    try {
      const { data, error } = await supabase
        .from('haulage_drivers')
        .insert([
          {
            company_id: profile.id,
            full_name: driverForm.full_name,
            phone: driverForm.phone,
            license_type: driverForm.license_type,
            is_active: true,
          },
        ])
        .select();

      if (error) throw error;

      if (data) {
        setDrivers([data[0], ...drivers]);
        setShowAddDriverModal(false);
        setDriverForm({
          full_name: '',
          phone: '',
          license_type: '',
        });
      }
    } catch (error) {
      console.error('Error adding driver:', error);
      alert('Failed to add driver');
    }
  };

  const toggleVehicleStatus = async (vehicleId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('haulage_vehicles')
        .update({ is_active: !currentStatus })
        .eq('id', vehicleId);

      if (error) throw error;

      setVehicles(
        vehicles.map((v) =>
          v.id === vehicleId ? { ...v, is_active: !currentStatus } : v
        )
      );
    } catch (error) {
      console.error('Error updating vehicle status:', error);
    }
  };

  const toggleDriverStatus = async (driverId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('haulage_drivers')
        .update({ is_active: !currentStatus })
        .eq('id', driverId);

      if (error) throw error;

      setDrivers(
        drivers.map((d) =>
          d.id === driverId ? { ...d, is_active: !currentStatus } : d
        )
      );
    } catch (error) {
      console.error('Error updating driver status:', error);
    }
  };

  const vehicleTypeOptions = [
    'Box Truck',
    'Flatbed',
    'Refrigerated Truck',
    'Tipper',
    'Lowboy',
    'Van',
    'Pickup Truck',
  ];

  const licenseTypeOptions = ['Class A', 'Class B', 'Class C', 'Class D'];

  const vehicleTypeBreakdown = vehicles.reduce((acc, vehicle) => {
    const type = vehicle.vehicle_type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const specialEquipmentSet = new Set<string>();
  vehicles.forEach((vehicle) => {
    if (vehicle.special_equipment) {
      vehicle.special_equipment.split(',').forEach((equip) => {
        specialEquipmentSet.add(equip.trim());
      });
    }
  });

  const maxCapacity = vehicles.length > 0
    ? Math.max(...vehicles.map((v) => v.capacity_kg || 0))
    : 0;

  const avgCapacity = vehicles.length > 0
    ? Math.round(vehicles.reduce((sum, v) => sum + (v.capacity_kg || 0), 0) / vehicles.length)
    : 0;

  const activeDrivers = drivers.filter((d) => d.is_active);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const InfoCard = ({
    icon: Icon,
    label,
    value,
    subtitle,
    bgGradient,
    iconBg,
    iconColor,
    textColor,
    subtitleColor
  }: {
    icon: any;
    label: string;
    value: string | number;
    subtitle: string;
    bgGradient: string;
    iconBg: string;
    iconColor: string;
    textColor: string;
    subtitleColor: string;
  }) => (
    <div className={`${bgGradient} rounded-xl p-5 border shadow-sm`}>
      <div className="flex items-start gap-3 mb-3">
        <div className={`${iconBg} p-2 rounded-lg flex-shrink-0`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-medium ${subtitleColor}`}>{label}</h3>
        </div>
      </div>
      <div className={`text-2xl font-bold ${textColor} truncate`}>
        {value}
      </div>
      <p className={`text-xs ${subtitleColor} mt-2`}>{subtitle}</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InfoCard
          icon={Truck}
          label="Total Vehicles"
          value={vehicles.length}
          subtitle="All registered vehicles"
          bgGradient="bg-gradient-to-br from-blue-50 to-blue-100"
          iconBg="bg-blue-600"
          iconColor="text-white"
          textColor="text-blue-900"
          subtitleColor="text-blue-700"
        />

        <InfoCard
          icon={Truck}
          label="Active Vehicles"
          value={vehicles.filter(v => v.is_active).length}
          subtitle="Ready for operations"
          bgGradient="bg-gradient-to-br from-green-50 to-green-100"
          iconBg="bg-green-600"
          iconColor="text-white"
          textColor="text-green-900"
          subtitleColor="text-green-700"
        />

        <InfoCard
          icon={Weight}
          label="Total Capacity"
          value={maxCapacity > 0 ? `${maxCapacity.toLocaleString()} kg` : '0 kg'}
          subtitle="Maximum single vehicle capacity"
          bgGradient="bg-gradient-to-br from-teal-50 to-teal-100"
          iconBg="bg-teal-600"
          iconColor="text-white"
          textColor="text-teal-900"
          subtitleColor="text-teal-700"
        />

        <InfoCard
          icon={Weight}
          label="Average Capacity"
          value={avgCapacity > 0 ? `${avgCapacity.toLocaleString()} kg` : '0 kg'}
          subtitle="Per vehicle average"
          bgGradient="bg-gradient-to-br from-cyan-50 to-cyan-100"
          iconBg="bg-cyan-600"
          iconColor="text-white"
          textColor="text-cyan-900"
          subtitleColor="text-cyan-700"
        />

        <InfoCard
          icon={Users}
          label="Total Drivers"
          value={drivers.length}
          subtitle="All registered drivers"
          bgGradient="bg-gradient-to-br from-orange-50 to-orange-100"
          iconBg="bg-orange-600"
          iconColor="text-white"
          textColor="text-orange-900"
          subtitleColor="text-orange-700"
        />

        <InfoCard
          icon={Users}
          label="Active Drivers"
          value={activeDrivers.length}
          subtitle="Currently available"
          bgGradient="bg-gradient-to-br from-amber-50 to-amber-100"
          iconBg="bg-amber-600"
          iconColor="text-white"
          textColor="text-amber-900"
          subtitleColor="text-amber-700"
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Package className="w-4 h-4 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Fleet Breakdown by Type</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {Object.entries(vehicleTypeBreakdown).length > 0 ? (
            Object.entries(vehicleTypeBreakdown).map(([type, count]) => (
              <span key={type} className="px-3 py-1.5 bg-blue-50 text-blue-700 text-sm font-medium rounded-lg border border-blue-200">
                {count} {type}
              </span>
            ))
          ) : (
            <span className="text-gray-400 italic text-sm">No vehicles registered</span>
          )}
        </div>
      </div>

      {specialEquipmentSet.size > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Package className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Special Equipment Available</h3>
          </div>
          <p className="text-gray-700 text-sm">
            {Array.from(specialEquipmentSet).join(', ')}
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Truck className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Vehicle Roster</h3>
          </div>
          <button
            onClick={() => setShowAddVehicleModal(true)}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Vehicle
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {vehicles.length > 0 ? (
            vehicles.map((vehicle) => (
              <div key={vehicle.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">{vehicle.vehicle_name}</p>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${vehicle.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {vehicle.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">{vehicle.vehicle_type} • {vehicle.plate_number || 'No plate'} • {vehicle.capacity_kg ? `${vehicle.capacity_kg.toLocaleString()} kg` : 'N/A'}</p>
                  {vehicle.special_equipment && (
                    <p className="text-xs text-gray-500 mt-1">Equipment: {vehicle.special_equipment}</p>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  <button className="p-2 hover:bg-blue-100 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4 text-blue-600" />
                  </button>
                  <button className="p-2 hover:bg-red-100 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400 italic text-center py-8">No vehicles registered yet</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center">
              <Users className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-sm font-semibold text-gray-900">Driver Roster</h3>
          </div>
          <button
            onClick={() => setShowAddDriverModal(true)}
            className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </button>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {drivers.length > 0 ? (
            drivers.map((driver) => (
              <div key={driver.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-gray-900">{driver.full_name}</p>
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${driver.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'}`}>
                      {driver.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    {driver.license_type ? `License: ${driver.license_type}` : 'No license info'}
                    {driver.phone && ` • ${driver.phone}`}
                  </p>
                </div>
                <div className="flex gap-2 ml-4">
                  <button className="p-2 hover:bg-orange-100 rounded-lg transition-colors">
                    <Edit2 className="w-4 h-4 text-orange-600" />
                  </button>
                  <button className="p-2 hover:bg-red-100 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-400 italic text-center py-8">No drivers registered yet</p>
          )}
        </div>
      </div>

      {showAddVehicleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Vehicle</h3>
              <button
                onClick={() => setShowAddVehicleModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddVehicle} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Name/Unit Number
                </label>
                <input
                  type="text"
                  required
                  value={vehicleForm.vehicle_name}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, vehicle_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Unit 01, Truck A"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vehicle Type
                </label>
                <select
                  required
                  value={vehicleForm.vehicle_type}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, vehicle_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select type</option>
                  {vehicleTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Plate Number
                </label>
                <input
                  type="text"
                  value={vehicleForm.plate_number}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, plate_number: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., ABC-1234"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Load (kg)
                </label>
                <input
                  type="number"
                  value={vehicleForm.capacity_kg}
                  onChange={(e) =>
                    setVehicleForm({ ...vehicleForm, capacity_kg: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 5000"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddVehicleModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Vehicle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showAddDriverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Add New Driver</h3>
              <button
                onClick={() => setShowAddDriverModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddDriver} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={driverForm.full_name}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, full_name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={driverForm.phone}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, phone: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., +1 234 567 8900"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Class
                </label>
                <select
                  value={driverForm.license_type}
                  onChange={(e) =>
                    setDriverForm({ ...driverForm, license_type: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select license class</option>
                  {licenseTypeOptions.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddDriverModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Driver
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
