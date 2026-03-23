import { useState, useEffect } from 'react';
import { X, User, Check, Loader2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface CourierPersonalInfoProps {
  open: boolean;
  onClose: () => void;
}

export function CourierPersonalInfo({ open, onClose }: CourierPersonalInfoProps) {
  const { profile, user, refreshProfile } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    homeAddress: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (profile && open) {
      setForm({
        fullName: profile.full_name || '',
        phone: profile.phone || '',
        email: profile.email || '',
        homeAddress: profile.home_base_location_text || '',
      });
      setSaved(false);
    }
  }, [profile, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: form.fullName,
          phone: form.phone,
          home_base_location_text: form.homeAddress,
        })
        .eq('id', user.id);

      if (error) throw error;
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving personal info:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
      <header className="flex-shrink-0 bg-moveme-blue-900 text-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <User className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Account Details</h1>
              <p className="text-xs text-white/50 mt-0.5">Manage your personal information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-lg mx-auto p-4 space-y-4">
          {saved && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3 animate-fade-in-up">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-800">Changes saved successfully</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 flex items-center gap-2.5">
              <User className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-gray-900">Personal Details</h3>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Enter your full name"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone Number</label>
                <div className="flex">
                  <div className="flex items-center px-3 bg-slate-100 border border-r-0 border-gray-200 rounded-l-xl">
                    <span className="text-xs font-medium text-gray-500">+1 868</span>
                  </div>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="555-0123"
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-r-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={form.email}
                  disabled
                  className="w-full px-3.5 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed"
                />
                <p className="text-[11px] text-gray-400 mt-1">
                  Email cannot be changed from here. Contact support for assistance.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Home Address</label>
                <input
                  type="text"
                  value={form.homeAddress}
                  onChange={(e) => setForm({ ...form, homeAddress: e.target.value })}
                  placeholder="Enter your home address"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSave}
            disabled={saving || !form.fullName.trim()}
            className="w-full py-3.5 bg-moveme-blue-600 hover:bg-moveme-blue-700 text-white text-sm font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>

          <div className="pb-6" />
        </div>
      </div>
    </div>
  );
}
