import { useState } from 'react';
import { X, MapPin, Save, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface SaveLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  latitude: number;
  longitude: number;
  onSaved?: () => void;
}

export function SaveLocationModal({
  isOpen,
  onClose,
  address,
  latitude,
  longitude,
  onSaved,
}: SaveLocationModalProps) {
  const { user } = useAuth();
  const [nickname, setNickname] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!user || !nickname.trim()) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('saved_locations')
        .insert({
          user_id: user.id,
          nickname: nickname.trim(),
          full_address: address,
          latitude,
          longitude,
          usage_count: 1,
        });

      if (error) throw error;

      onSaved?.();
      setNickname('');
      onClose();
    } catch (error) {
      console.error('Error saving location:', error);
      alert('Failed to save location. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setNickname('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Frequent Stop?</h2>
              <p className="text-sm text-gray-500">Save for faster booking</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="mb-6">
          <div className="bg-gray-50 p-3 rounded-lg mb-4">
            <p className="text-sm text-gray-600 mb-1">Address</p>
            <p className="text-sm font-medium text-gray-900">{address}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Give it a nickname
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g., Mom's House, Client B, Warehouse A"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={50}
              disabled={saving}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Choose a memorable name to find this location quickly
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            disabled={saving}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50"
          >
            No Thanks
          </button>
          <button
            onClick={handleSave}
            disabled={!nickname.trim() || saving}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Save Location
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
