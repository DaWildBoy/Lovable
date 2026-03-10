import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  Loader2,
  Building2,
  Shield,
  MapPin,
  Phone,
  Check,
  ArrowLeft,
  Truck,
  Clock,
  Package,
} from 'lucide-react';

const REGIONS = ['North', 'South', 'East', 'West', 'Central', 'Tobago'];
const SPECIALTIES = ['General Cargo', 'Fragile Items', 'Refrigerated', 'Heavy Equipment', 'Hazardous Materials', 'Oversized Loads'];
const EQUIPMENT_TYPES = ['Flatbed', 'Box Truck', 'Refrigerated', 'Tanker', 'Car Carrier', 'Heavy Hauler'];

export function HaulageOnboardingPage() {
  const { user, refreshProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    business_registration: '',
    tax_id: '',
    years_in_operation: '',
    service_highlights: '',
    insurance_status: 'None',
    insurance_expiry: '',
    operating_regions: [] as string[],
    cargo_specialties: [] as string[],
    equipment_types: [] as string[],
    service_hours: 'Business Hours',
    emergency_contact: '',
    dispatch_phone: '',
    preferred_contact_method: 'App',
    payment_terms: 'Immediate',
    billing_email: '',
    billing_phone: '',
  });

  const updateField = (field: string, value: string | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleArrayItem = (field: 'operating_regions' | 'cargo_specialties' | 'equipment_types', item: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item],
    }));
  };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!formData.business_registration.trim()) {
        setError('Business registration number is required');
        return;
      }
    }
    if (step === 2) {
      if (formData.operating_regions.length === 0) {
        setError('Select at least one operating region');
        return;
      }
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    setError('');
    if (!formData.emergency_contact.trim()) {
      setError('Emergency contact number is required');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          haulage_business_registration: formData.business_registration,
          haulage_tax_id: formData.tax_id || null,
          haulage_years_in_operation: formData.years_in_operation ? parseInt(formData.years_in_operation) : null,
          haulage_service_highlights: formData.service_highlights || null,
          haulage_insurance_status: formData.insurance_status,
          haulage_insurance_expiry: formData.insurance_expiry || null,
          haulage_operating_regions: formData.operating_regions,
          haulage_cargo_specialties: formData.cargo_specialties,
          haulage_equipment_types: formData.equipment_types,
          haulage_service_hours: formData.service_hours,
          haulage_emergency_contact: formData.emergency_contact,
          haulage_dispatch_phone: formData.dispatch_phone || null,
          haulage_preferred_contact_method: formData.preferred_contact_method,
          haulage_payment_terms: formData.payment_terms,
          haulage_billing_email: formData.billing_email || null,
          haulage_billing_phone: formData.billing_phone || null,
          haulage_onboarding_completed: true,
          business_verification_status: 'approved',
          business_verified: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id);

      if (updateError) throw updateError;

      setStep(4);
      await refreshProfile();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while saving your information');
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 4) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="inline-flex p-4 rounded-full bg-green-100 mb-6">
            <Check className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Company Setup Complete
          </h1>
          <p className="text-gray-600 mb-6">
            Your haulage company profile has been set up. You can now start accepting delivery jobs.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              You can update your company information anytime from your profile page.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const stepLabels = ['Company Details', 'Operations', 'Contact & Billing'];

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Haulage Company Setup</h1>
              <p className="text-blue-100 text-sm">Complete your company profile to get started</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {stepLabels.map((label, i) => (
              <div key={label} className="flex-1">
                <div className={`h-1.5 rounded-full transition-all ${
                  i + 1 <= step ? 'bg-white' : 'bg-white/30'
                }`} />
                <p className={`text-xs mt-1.5 ${
                  i + 1 <= step ? 'text-white font-medium' : 'text-blue-200'
                }`}>
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="p-8">
          {step === 1 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Company Details</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Business Registration Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.business_registration}
                  onChange={(e) => updateField('business_registration', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g. BRN-12345678"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Tax ID
                  </label>
                  <input
                    type="text"
                    value={formData.tax_id}
                    onChange={(e) => updateField('tax_id', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Tax ID number"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Years in Operation
                  </label>
                  <input
                    type="number"
                    value={formData.years_in_operation}
                    onChange={(e) => updateField('years_in_operation', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Insurance Status
                </label>
                <select
                  value={formData.insurance_status}
                  onChange={(e) => updateField('insurance_status', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="None">None</option>
                  <option value="Active">Active</option>
                  <option value="Expired">Expired</option>
                </select>
              </div>

              {formData.insurance_status === 'Active' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Insurance Expiry Date
                  </label>
                  <input
                    type="date"
                    value={formData.insurance_expiry}
                    onChange={(e) => updateField('insurance_expiry', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  About Your Company
                </label>
                <textarea
                  value={formData.service_highlights}
                  onChange={(e) => updateField('service_highlights', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="Briefly describe your services, fleet size, and strengths..."
                  rows={3}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-2">
                <Package className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Operations & Capabilities</h2>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <MapPin className="w-4 h-4 text-gray-500" />
                  Operating Regions <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {REGIONS.map((region) => (
                    <button
                      key={region}
                      type="button"
                      onClick={() => toggleArrayItem('operating_regions', region)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                        formData.operating_regions.includes(region)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {region}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <Truck className="w-4 h-4 text-gray-500" />
                  Cargo Specialties
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SPECIALTIES.map((specialty) => (
                    <button
                      key={specialty}
                      type="button"
                      onClick={() => toggleArrayItem('cargo_specialties', specialty)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all text-left ${
                        formData.cargo_specialties.includes(specialty)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {specialty}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-3">
                  <Shield className="w-4 h-4 text-gray-500" />
                  Equipment Types
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT_TYPES.map((eq) => (
                    <button
                      key={eq}
                      type="button"
                      onClick={() => toggleArrayItem('equipment_types', eq)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all text-left ${
                        formData.equipment_types.includes(eq)
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {eq}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                  <Clock className="w-4 h-4 text-gray-500" />
                  Service Hours
                </label>
                <select
                  value={formData.service_hours}
                  onChange={(e) => updateField('service_hours', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="Business Hours">Business Hours (8am-5pm)</option>
                  <option value="Extended Hours">Extended Hours (6am-10pm)</option>
                  <option value="24/7">24/7 Available</option>
                </select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-gray-900">Contact & Billing</h2>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Emergency Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData.emergency_contact}
                  onChange={(e) => updateField('emergency_contact', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="868-123-4567"
                />
                <p className="text-xs text-gray-500 mt-1">Available 24/7 for urgent matters</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Dispatch Phone
                </label>
                <input
                  type="tel"
                  value={formData.dispatch_phone}
                  onChange={(e) => updateField('dispatch_phone', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="868-123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Preferred Contact Method
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {['App', 'SMS', 'Email', 'Phone'].map((method) => (
                    <button
                      key={method}
                      type="button"
                      onClick={() => updateField('preferred_contact_method', method)}
                      className={`px-3 py-2 text-sm font-medium rounded-lg border-2 transition-all ${
                        formData.preferred_contact_method === method
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-gray-200" />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Payment Terms
                </label>
                <select
                  value={formData.payment_terms}
                  onChange={(e) => updateField('payment_terms', e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
                  <option value="Immediate">Immediate Payment</option>
                  <option value="NET 7">NET 7 Days</option>
                  <option value="NET 15">NET 15 Days</option>
                  <option value="NET 30">NET 30 Days</option>
                  <option value="NET 60">NET 60 Days</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Billing Email
                  </label>
                  <input
                    type="email"
                    value={formData.billing_email}
                    onChange={(e) => updateField('billing_email', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="billing@company.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Billing Phone
                  </label>
                  <input
                    type="tel"
                    value={formData.billing_phone}
                    onChange={(e) => updateField('billing_phone', e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="868-123-4567"
                  />
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                type="button"
                onClick={() => { setError(''); setStep(step - 1); }}
                className="flex items-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={handleNext}
                className="flex-1 py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="flex-1 py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? 'Saving...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
