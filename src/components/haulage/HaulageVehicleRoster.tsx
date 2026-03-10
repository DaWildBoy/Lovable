import { useState, useEffect } from 'react';
import { Truck, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
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
  created_at: string;
}

export function HaulageVehicleRoster() {
  const { profile } = useAuth();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);

  const [formData, setFormData] = useState({
    vehicle_name: '',
    plate_number: '',
    vehicle_type: '',
    capacity_kg: '',
    special_equipment: '',
    is_active: true,
  });

  useEffect(() => {
    fetchVehicles();
  }, [profile]);

  const fetchVehicles = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('haulage_vehicles')
        .select('*')
        .eq('company_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error) {
      console.error('Error fetching vehicles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      if (editingVehicle) {
        const { error } = await supabase
          .from('haulage_vehicles')
          .update({
            vehicle_name: formData.vehicle_name,
            plate_number: formData.plate_number || null,
            vehicle_type: formData.vehicle_type,
            capacity_kg: formData.capacity_kg ? parseFloat(formData.capacity_kg) : null,
            special_equipment: formData.special_equipment || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingVehicle.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('haulage_vehicles')
          .insert({
            company_id: profile.id,
            vehicle_name: formData.vehicle_name,
            plate_number: formData.plate_number || null,
            vehicle_type: formData.vehicle_type,
            capacity_kg: formData.capacity_kg ? parseFloat(formData.capacity_kg) : null,
            special_equipment: formData.special_equipment || null,
            is_active: formData.is_active,
          });

        if (error) throw error;
      }

      await fetchVehicles();
      setShowModal(false);
      setEditingVehicle(null);
      setFormData({
        vehicle_name: '',
        plate_number: '',
        vehicle_type: '',
        capacity_kg: '',
        special_equipment: '',
        is_active: true,
      });
    } catch (error) {
      console.error('Error saving vehicle:', error);
      alert('Failed to save vehicle');
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setEditingVehicle(vehicle);
    setFormData({
      vehicle_name: vehicle.vehicle_name,
      plate_number: vehicle.plate_number || '',
      vehicle_type: vehicle.vehicle_type,
      capacity_kg: vehicle.capacity_kg?.toString() || '',
      special_equipment: vehicle.special_equipment || '',
      is_active: vehicle.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (vehicleId: string) => {
    if (!confirm('Are you sure you want to delete this vehicle?')) return;

    try {
      const { error } = await supabase
        .from('haulage_vehicles')
        .delete()
        .eq('id', vehicleId);

      if (error) throw error;
      await fetchVehicles();
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      alert('Failed to delete vehicle');
    }
  };

  const toggleVehicleStatus = async (vehicle: Vehicle) => {
    try {
      const { error } = await supabase
        .from('haulage_vehicles')
        .update({
          is_active: !vehicle.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', vehicle.id);

      if (error) throw error;
      await fetchVehicles();
    } catch (error) {
      console.error('Error toggling vehicle status:', error);
      alert('Failed to update vehicle status');
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

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">Loading vehicles...</div>
      </div>
    );
  }

  const activeVehicles = vehicles.filter(v => v.is_active);
  const inactiveVehicles = vehicles.filter(v => !v.is_active);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Vehicle Roster</h2>
              <p className="text-sm text-gray-600">{activeVehicles.length} active vehicle{activeVehicles.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingVehicle(null);
              setFormData({
                vehicle_name: '',
                plate_number: '',
                vehicle_type: '',
                capacity_kg: '',
                special_equipment: '',
                is_active: true,
              });
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Vehicle
          </button>
        </div>

        {vehicles.length === 0 ? (
          <div className="text-center py-8">
            <Truck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No vehicles added yet</p>
            <p className="text-sm text-gray-500">
              Add vehicles to your fleet to assign them to jobs
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeVehicles.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase">Active Vehicles</h3>
                {activeVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-orange-300 transition-all"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{vehicle.vehicle_name}</h3>
                          <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
                            {vehicle.vehicle_type}
                          </span>
                          {vehicle.is_active && (
                            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          {vehicle.plate_number && <div>Plate: {vehicle.plate_number}</div>}
                          {vehicle.capacity_kg && <div>Capacity: {vehicle.capacity_kg} kg</div>}
                          {vehicle.special_equipment && <div>Equipment: {vehicle.special_equipment}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => toggleVehicleStatus(vehicle)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-all"
                          title="Deactivate"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(vehicle)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {inactiveVehicles.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 uppercase">Inactive Vehicles</h3>
                {inactiveVehicles.map((vehicle) => (
                  <div
                    key={vehicle.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-600">{vehicle.vehicle_name}</h3>
                          <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">
                            Inactive
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => toggleVehicleStatus(vehicle)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Activate"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(vehicle.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
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
                  value={formData.vehicle_name}
                  onChange={(e) => setFormData({ ...formData, vehicle_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Unit 01, Truck A"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Plate Number
                </label>
                <input
                  type="text"
                  value={formData.plate_number}
                  onChange={(e) => setFormData({ ...formData, plate_number: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Enter plate number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vehicle Type *
                </label>
                <select
                  value={formData.vehicle_type}
                  onChange={(e) => setFormData({ ...formData, vehicle_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                  value={formData.capacity_kg}
                  onChange={(e) => setFormData({ ...formData, capacity_kg: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
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
                  value={formData.special_equipment}
                  onChange={(e) => setFormData({ ...formData, special_equipment: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="e.g., Liftgate, Crane, Straps"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="vehicle_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                />
                <label htmlFor="vehicle_active" className="text-sm text-gray-700">
                  Vehicle is active
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleSave}
                disabled={!formData.vehicle_name || !formData.vehicle_type}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Check className="w-4 h-4" />
                {editingVehicle ? 'Update' : 'Add Vehicle'}
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
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
    </>
  );
}
