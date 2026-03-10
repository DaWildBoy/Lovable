import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Settings, Save, Loader2, Phone, Mail, Bell, Truck, MessageSquare } from 'lucide-react';

interface Preferences {
  default_delivery_instructions: string;
  preferred_vehicle_type: string;
  default_tip_percentage: number;
  sms_notifications: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
}

interface Props {
  userId: string;
  onNavigate: (path: string) => void;
}

const vehicleOptions = [
  { value: '', label: 'No preference' },
  { value: 'car', label: 'Car' },
  { value: 'suv', label: 'SUV' },
  { value: 'van', label: 'Van' },
  { value: 'pickup_truck', label: 'Pickup Truck' },
  { value: 'flatbed', label: 'Flatbed' },
];

const tipOptions = [0, 5, 10, 15, 20];

export function CustomerProfilePreferences({ userId, onNavigate }: Props) {
  const [prefs, setPrefs] = useState<Preferences>({
    default_delivery_instructions: '',
    preferred_vehicle_type: '',
    default_tip_percentage: 0,
    sms_notifications: true,
    email_notifications: true,
    push_notifications: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, [userId]);

  const fetchPreferences = async () => {
    try {
      const { data } = await supabase
        .from('customer_delivery_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setPrefs({
          default_delivery_instructions: data.default_delivery_instructions || '',
          preferred_vehicle_type: data.preferred_vehicle_type || '',
          default_tip_percentage: data.default_tip_percentage || 0,
          sms_notifications: data.sms_notifications ?? true,
          email_notifications: data.email_notifications ?? true,
          push_notifications: data.push_notifications ?? true,
        });
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const { error } = await supabase
        .from('customer_delivery_preferences')
        .upsert({
          user_id: userId,
          ...prefs,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) throw error;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Error saving preferences:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4">
        <div className="max-w-4xl mx-auto">
          <div className="card p-6 animate-pulse">
            <div className="h-5 bg-gray-100 rounded w-40 mb-4" />
            <div className="space-y-4">
              <div className="h-10 bg-gray-100 rounded" />
              <div className="h-10 bg-gray-100 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Delivery Preferences</h2>
        </div>
        <div className="card overflow-hidden">
          <div className="p-4 space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <MessageSquare className="w-4 h-4 text-gray-400" />
                Default Delivery Instructions
              </label>
              <textarea
                value={prefs.default_delivery_instructions}
                onChange={(e) => setPrefs({ ...prefs, default_delivery_instructions: e.target.value })}
                placeholder="e.g., Call on arrival, leave at gate..."
                className="input-field resize-none"
                rows={2}
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Truck className="w-4 h-4 text-gray-400" />
                Preferred Vehicle Type
              </label>
              <select
                value={prefs.preferred_vehicle_type}
                onChange={(e) => setPrefs({ ...prefs, preferred_vehicle_type: e.target.value })}
                className="input-field"
              >
                {vehicleOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Settings className="w-4 h-4 text-gray-400" />
                Default Tip
              </label>
              <div className="flex gap-2">
                {tipOptions.map((tip) => (
                  <button
                    key={tip}
                    onClick={() => setPrefs({ ...prefs, default_tip_percentage: tip })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                      prefs.default_tip_percentage === tip
                        ? 'bg-moveme-blue-600 text-white border-moveme-blue-600 shadow-sm'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {tip === 0 ? 'None' : `${tip}%`}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-3">Notifications</p>
              <div className="space-y-3">
                {[
                  { key: 'push_notifications', label: 'Push Notifications', icon: Bell },
                  { key: 'email_notifications', label: 'Email Notifications', icon: Mail },
                  { key: 'sms_notifications', label: 'SMS Notifications', icon: Phone },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <label key={item.key} className="flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-2.5">
                        <Icon className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-700">{item.label}</span>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={prefs[item.key as keyof Preferences] as boolean}
                          onChange={(e) => setPrefs({ ...prefs, [item.key]: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-gray-200 rounded-full peer-checked:bg-moveme-blue-600 transition-colors" />
                        <div className="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transform peer-checked:translate-x-4 transition-transform" />
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
            <button
              onClick={savePreferences}
              disabled={saving}
              className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                saved
                  ? 'bg-emerald-600 text-white'
                  : 'bg-moveme-blue-600 text-white hover:bg-moveme-blue-700'
              }`}
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : saved ? (
                <>
                  <Settings className="w-4 h-4" />
                  Saved
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Preferences
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
