import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MapPin, Plus, Edit2, Trash2, Save, X, Loader2, Home, Upload, Download, Star, Briefcase } from 'lucide-react';
import { GooglePlacesAutocomplete } from '../components/GooglePlacesAutocomplete';

interface SavedLocation {
  id: string;
  user_id: string;
  nickname: string;
  full_address: string;
  latitude: number;
  longitude: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

interface AddressBookPageProps {
  onNavigate: (path: string) => void;
}

export function AddressBookPage({ onNavigate }: AddressBookPageProps) {
  const { user } = useAuth();
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<SavedLocation | null>(null);
  const [formData, setFormData] = useState({
    nickname: '',
    full_address: '',
    latitude: 0,
    longitude: 0,
  });
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', user.id)
        .order('usage_count', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNew = () => {
    setFormData({
      nickname: '',
      full_address: '',
      latitude: 0,
      longitude: 0,
    });
    setEditingLocation(null);
    setShowAddModal(true);
  };

  const handleEdit = (location: SavedLocation) => {
    setFormData({
      nickname: location.nickname,
      full_address: location.full_address,
      latitude: location.latitude,
      longitude: location.longitude,
    });
    setEditingLocation(location);
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    try {
      const { error } = await supabase
        .from('saved_locations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      alert('Failed to delete location');
    }
  };

  const handleSave = async () => {
    if (!user || !formData.nickname || !formData.full_address) {
      alert('Please fill in all required fields');
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      alert('Please select a valid address with coordinates');
      return;
    }

    setSaving(true);
    try {
      if (editingLocation) {
        const { error } = await supabase
          .from('saved_locations')
          .update({
            nickname: formData.nickname,
            full_address: formData.full_address,
            latitude: formData.latitude,
            longitude: formData.longitude,
          })
          .eq('id', editingLocation.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('saved_locations')
          .insert({
            user_id: user.id,
            nickname: formData.nickname,
            full_address: formData.full_address,
            latitude: formData.latitude,
            longitude: formData.longitude,
            usage_count: 0,
          });

        if (error) throw error;
      }

      setShowAddModal(false);
      fetchLocations();
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location');
    } finally {
      setSaving(false);
    }
  };

  const handleAddressChange = (address: string, lat: number, lng: number) => {
    setFormData({
      ...formData,
      full_address: address,
      latitude: lat,
      longitude: lng,
    });
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());

      if (lines.length < 2) {
        alert('CSV file must have at least a header row and one data row');
        return;
      }

      const header = lines[0].toLowerCase();
      if (!header.includes('name') || !header.includes('address')) {
        alert('CSV must have "Name" and "Address" columns');
        return;
      }

      const locationsToImport: Array<{
        user_id: string;
        nickname: string;
        full_address: string;
        latitude: number;
        longitude: number;
        usage_count: number;
      }> = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const parts = line.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
        if (parts.length < 2) continue;

        const nickname = parts[0];
        const address = parts.slice(1).join(', ');

        if (!nickname || !address) continue;

        try {
          const geocoder = new google.maps.Geocoder();
          const result = await geocoder.geocode({
            address: address,
            componentRestrictions: { country: 'tt' }
          });

          if (result.results[0]) {
            const location = result.results[0].geometry.location;
            locationsToImport.push({
              user_id: user.id,
              nickname,
              full_address: result.results[0].formatted_address,
              latitude: location.lat(),
              longitude: location.lng(),
              usage_count: 0,
            });
          }
        } catch (error) {
          console.error(`Failed to geocode: ${address}`, error);
        }
      }

      if (locationsToImport.length === 0) {
        alert('No valid addresses found in CSV');
        return;
      }

      const { error } = await supabase
        .from('saved_locations')
        .insert(locationsToImport);

      if (error) throw error;

      alert(`Successfully imported ${locationsToImport.length} location${locationsToImport.length !== 1 ? 's' : ''}`);
      fetchLocations();
    } catch (error) {
      console.error('Error importing CSV:', error);
      alert('Failed to import CSV. Please check the format and try again.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = 'Name,Address\nClient A,123 Main Street Port of Spain\nWarehouse B,45 Industrial Avenue Chaguanas\n';
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'address-book-template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => onNavigate('/profile')}
                className="text-blue-600 hover:text-blue-700 text-sm font-medium mb-2"
              >
                &larr; Back to Profile
              </button>
              <h1 className="text-xl font-bold text-gray-900">Address Book</h1>
              <p className="text-sm text-gray-600 mt-1">Save frequently used locations for quick booking</p>
            </div>
            <button
              onClick={handleAddNew}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-sm border border-blue-100 p-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-gray-900 mb-1">Business Tools</h2>
              <p className="text-sm text-gray-600 mb-4">
                Upload a CSV file to bulk import multiple client addresses at once
              </p>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" />
                      Upload Client List
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>

              <p className="text-xs text-gray-500 mt-3">
                CSV format: Name, Address (e.g., "Client A, 123 Main St Port of Spain")
              </p>
            </div>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleCSVUpload}
          className="hidden"
        />

        {locations.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Home className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No saved locations</h3>
            <p className="text-gray-600 mb-6">
              Add your frequently used addresses for quick access when creating jobs
            </p>
            <button
              onClick={handleAddNew}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Add Your First Location
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((location) => (
              <div
                key={location.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center flex-shrink-0">
                    <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mb-1">{location.nickname}</h3>
                    <p className="text-sm text-gray-600 mb-1">{location.full_address}</p>
                    {location.usage_count > 0 && (
                      <p className="text-xs text-gray-500">
                        Used {location.usage_count} time{location.usage_count !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(location)}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(location.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
              <h3 className="text-lg font-semibold">
                {editingLocation ? 'Edit Location' : 'Add New Location'}
              </h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nickname <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Mom's House, Client B, Warehouse A"
                  value={formData.nickname}
                  onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={50}
                />
              </div>

              <GooglePlacesAutocomplete
                value={formData.full_address}
                onChange={handleAddressChange}
                placeholder="Enter address"
                label="Address"
              />

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !formData.nickname || !formData.full_address || !formData.latitude}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
