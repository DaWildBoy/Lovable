import { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Star, Check, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface SavedLocation {
  id: string;
  location_name: string;
  address_text: string;
  latitude: number | null;
  longitude: number | null;
  location_notes: string | null;
  is_default_pickup: boolean;
}

export function RetailSavedLocations() {
  const { profile } = useAuth();
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);

  const [formData, setFormData] = useState({
    location_name: '',
    address_text: '',
    location_notes: '',
    is_default_pickup: false,
  });

  useEffect(() => {
    fetchLocations();
  }, [profile]);

  const fetchLocations = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('retail_saved_locations')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching saved locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('retail_saved_locations')
          .update({
            location_name: formData.location_name,
            address_text: formData.address_text,
            location_notes: formData.location_notes,
            is_default_pickup: formData.is_default_pickup,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingLocation.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('retail_saved_locations')
          .insert({
            profile_id: profile.id,
            location_name: formData.location_name,
            address_text: formData.address_text,
            location_notes: formData.location_notes,
            is_default_pickup: formData.is_default_pickup,
          });

        if (error) throw error;
      }

      await fetchLocations();
      setShowAddModal(false);
      setEditingLocation(null);
      setFormData({
        location_name: '',
        address_text: '',
        location_notes: '',
        is_default_pickup: false,
      });
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location');
    }
  };

  const handleEdit = (location: SavedLocation) => {
    setEditingLocation(location);
    setFormData({
      location_name: location.location_name,
      address_text: location.address_text,
      location_notes: location.location_notes || '',
      is_default_pickup: location.is_default_pickup,
    });
    setShowAddModal(true);
  };

  const handleDelete = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    try {
      const { error } = await supabase
        .from('retail_saved_locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;
      await fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">Loading saved locations...</div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Saved Locations</h2>
              <p className="text-sm text-gray-600">Quick access to frequently used addresses</p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditingLocation(null);
              setFormData({
                location_name: '',
                address_text: '',
                location_notes: '',
                is_default_pickup: false,
              });
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Location
          </button>
        </div>

        {locations.length === 0 ? (
          <div className="text-center py-8">
            <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No saved locations yet</p>
            <p className="text-sm text-gray-500">
              Add frequently used pickup and delivery locations for quick access
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((location) => (
              <div
                key={location.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{location.location_name}</h3>
                      {location.is_default_pickup && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full">
                          <Star className="w-3 h-3" />
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{location.address_text}</p>
                    {location.location_notes && (
                      <p className="text-xs text-gray-500 italic">{location.location_notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleEdit(location)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(location.id)}
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

      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location Name
                </label>
                <input
                  type="text"
                  value={formData.location_name}
                  onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Main Warehouse, Store #5"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Address
                </label>
                <textarea
                  value={formData.address_text}
                  onChange={(e) => setFormData({ ...formData, address_text: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter full address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Location Notes
                </label>
                <textarea
                  value={formData.location_notes}
                  onChange={(e) => setFormData({ ...formData, location_notes: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  rows={2}
                  placeholder="Gate codes, loading bay info, business hours, etc."
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default_pickup}
                  onChange={(e) => setFormData({ ...formData, is_default_pickup: e.target.checked })}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="is_default" className="text-sm text-gray-700">
                  Set as default pickup location
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleSave}
                disabled={!formData.location_name || !formData.address_text}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Check className="w-4 h-4" />
                {editingLocation ? 'Update' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setEditingLocation(null);
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
