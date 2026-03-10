import { useState } from 'react';
import { X, MapPin, Home } from 'lucide-react';
import { GooglePlacesAutocomplete } from './GooglePlacesAutocomplete';

interface SetHomeBaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (location: { text: string; lat: number; lng: number }) => Promise<void>;
  currentHomeBase?: string;
}

export function SetHomeBaseModal({ isOpen, onClose, onSave, currentHomeBase }: SetHomeBaseModalProps) {
  const [homeBaseText, setHomeBaseText] = useState(currentHomeBase || '');
  const [homeBaseLat, setHomeBaseLat] = useState<number | null>(null);
  const [homeBaseLng, setHomeBaseLng] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!homeBaseText || homeBaseLat === null || homeBaseLng === null) {
      alert('Please select a valid home base location');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        text: homeBaseText,
        lat: homeBaseLat,
        lng: homeBaseLng,
      });
      onClose();
    } catch (error) {
      console.error('Error saving home base:', error);
      alert('Failed to save home base. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 rounded-full p-2">
              <Home className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Set Home Base</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <MapPin className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Why set a home base?</h3>
                <p className="text-sm text-blue-700">
                  We'll notify you of return trip opportunities that match your route home,
                  helping you earn money instead of driving back empty!
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Home Base Location
            </label>
            <GooglePlacesAutocomplete
              value={homeBaseText}
              onChange={(address, lat, lng) => {
                setHomeBaseText(address);
                setHomeBaseLat(lat);
                setHomeBaseLng(lng);
              }}
              placeholder="Enter your home address or usual end location"
            />
            <p className="mt-2 text-xs text-gray-500">
              This helps us find jobs that end near your home, maximizing your earnings
            </p>
          </div>

          {currentHomeBase && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs text-green-700">
                <span className="font-semibold">Current home base:</span> {currentHomeBase}
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !homeBaseText || homeBaseLat === null}
            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : 'Save Home Base'}
          </button>
        </div>
      </div>
    </div>
  );
}
