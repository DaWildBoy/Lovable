import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { MapPin, X, Loader2, Home } from 'lucide-react';

interface SavedAddress {
  id: string;
  label: string;
  address_text: string;
  lat: number | null;
  lng: number | null;
  notes: string | null;
}

interface SavedAddressPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (address: { text: string; lat?: number; lng?: number }) => void;
}

export function SavedAddressPicker({ isOpen, onClose, onSelect }: SavedAddressPickerProps) {
  const { profile } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      fetchAddresses();
    }
  }, [isOpen]);

  const fetchAddresses = async () => {
    if (!profile) return;

    try {
      setLoading(true);
      const merged: SavedAddress[] = [];

      const { data: addrData } = await supabase
        .from('saved_addresses')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (addrData) {
        merged.push(...addrData);
      }

      const { data: locData } = await supabase
        .from('saved_locations')
        .select('*')
        .eq('user_id', profile.id)
        .order('usage_count', { ascending: false });

      if (locData) {
        const existingTexts = new Set(merged.map(a => a.address_text.toLowerCase()));
        for (const loc of locData) {
          if (!existingTexts.has(loc.full_address.toLowerCase())) {
            merged.push({
              id: loc.id,
              label: loc.nickname,
              address_text: loc.full_address,
              lat: loc.latitude,
              lng: loc.longitude,
              notes: null,
            });
          }
        }
      }

      setAddresses(merged);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (address: SavedAddress) => {
    onSelect({
      text: address.address_text,
      lat: address.lat || undefined,
      lng: address.lng || undefined,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[70vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Saved Addresses</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
          ) : addresses.length === 0 ? (
            <div className="text-center py-8">
              <Home className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No saved addresses yet</p>
              <p className="text-sm text-gray-500">
                Go to Profile → Address Book to add addresses
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {addresses.map((address) => (
                <button
                  key={address.id}
                  onClick={() => handleSelect(address)}
                  className="w-full p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all text-left"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 mb-0.5">{address.label}</p>
                      <p className="text-sm text-gray-600">{address.address_text}</p>
                      {address.notes && (
                        <p className="text-xs text-gray-500 mt-1 italic">{address.notes}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
