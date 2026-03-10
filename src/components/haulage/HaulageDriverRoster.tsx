import { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Check, X, UserCheck, UserX, Copy, RefreshCw } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  license_type: string | null;
  is_active: boolean;
  company_approved: boolean;
  created_at: string;
}

export function HaulageDriverRoster() {
  const { profile } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showCodeModal, setShowCodeModal] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    license_type: '',
    is_active: true,
  });

  useEffect(() => {
    fetchDrivers();
  }, [profile]);

  const fetchDrivers = async () => {
    if (!profile) return;

    try {
      const { data, error } = await supabase
        .from('haulage_drivers')
        .select('*')
        .eq('company_id', profile.id)
        .eq('company_approved', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDrivers(data || []);
    } catch (error) {
      console.error('Error fetching drivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;

    try {
      if (editingDriver) {
        const { error } = await supabase
          .from('haulage_drivers')
          .update({
            full_name: formData.full_name,
            phone: formData.phone || null,
            license_type: formData.license_type || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingDriver.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('haulage_drivers')
          .insert({
            company_id: profile.id,
            full_name: formData.full_name,
            phone: formData.phone || null,
            license_type: formData.license_type || null,
            is_active: formData.is_active,
          });

        if (error) throw error;
      }

      await fetchDrivers();
      setShowModal(false);
      setEditingDriver(null);
      setFormData({
        full_name: '',
        phone: '',
        license_type: '',
        is_active: true,
      });
    } catch (error) {
      console.error('Error saving driver:', error);
      alert('Failed to save driver');
    }
  };

  const handleEdit = (driver: Driver) => {
    setEditingDriver(driver);
    setFormData({
      full_name: driver.full_name,
      phone: driver.phone || '',
      license_type: driver.license_type || '',
      is_active: driver.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (driverId: string) => {
    if (!confirm('Are you sure you want to delete this driver?')) return;

    try {
      const { error } = await supabase
        .from('haulage_drivers')
        .delete()
        .eq('id', driverId);

      if (error) throw error;
      await fetchDrivers();
    } catch (error) {
      console.error('Error deleting driver:', error);
      alert('Failed to delete driver');
    }
  };

  const toggleDriverStatus = async (driver: Driver) => {
    try {
      const { error } = await supabase
        .from('haulage_drivers')
        .update({
          is_active: !driver.is_active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', driver.id);

      if (error) throw error;
      await fetchDrivers();
    } catch (error) {
      console.error('Error toggling driver status:', error);
      alert('Failed to update driver status');
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="text-center text-gray-500">Loading drivers...</div>
      </div>
    );
  }

  const activeDrivers = drivers.filter(d => d.is_active);
  const inactiveDrivers = drivers.filter(d => !d.is_active);

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Driver Roster</h2>
              <p className="text-sm text-gray-600">{activeDrivers.length} active driver{activeDrivers.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button
            onClick={() => setShowCodeModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Driver
          </button>
        </div>

        {drivers.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-2">No drivers added yet</p>
            <p className="text-sm text-gray-500">
              Add drivers to your roster to assign them to jobs
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeDrivers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700 uppercase">Active Drivers</h3>
                {activeDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="border border-gray-200 rounded-lg p-4 hover:border-green-300 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900">{driver.full_name}</h3>
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                            <UserCheck className="w-3 h-3" />
                            Active
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 space-y-1">
                          {driver.phone && <div>Phone: {driver.phone}</div>}
                          {driver.license_type && <div>License: {driver.license_type}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => toggleDriverStatus(driver)}
                          className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-all"
                          title="Deactivate"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleEdit(driver)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(driver.id)}
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

            {inactiveDrivers.length > 0 && (
              <div className="space-y-3 pt-4 border-t border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 uppercase">Inactive Drivers</h3>
                {inactiveDrivers.map((driver) => (
                  <div
                    key={driver.id}
                    className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-600">{driver.full_name}</h3>
                          <span className="flex items-center gap-1 px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">
                            <UserX className="w-3 h-3" />
                            Inactive
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2 ml-4">
                        <button
                          onClick={() => toggleDriverStatus(driver)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-all"
                          title="Activate"
                        >
                          <UserCheck className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(driver.id)}
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
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                Edit Driver
              </h3>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter driver's full name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  License Type
                </label>
                <input
                  type="text"
                  value={formData.license_type}
                  onChange={(e) => setFormData({ ...formData, license_type: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="e.g., Class 3, Class 5"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Driver is active
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex gap-3">
              <button
                onClick={handleSave}
                disabled={!formData.full_name}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Check className="w-4 h-4" />
                Update
              </button>
              <button
                onClick={() => {
                  setShowModal(false);
                  setEditingDriver(null);
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

      {showCodeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-green-600" />
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
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">1</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Share the code below with your driver</p>
                    <p className="text-xs text-gray-500 mt-0.5">Send it via WhatsApp, SMS, or in person</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">2</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">Driver signs up as a courier</p>
                    <p className="text-xs text-gray-500 mt-0.5">They enter this code during their sign-up process</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">3</span>
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
                      onClick={async () => {
                        const code = profile.haulage_company_code;
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
                      }}
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
                  setShowCodeModal(false);
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
