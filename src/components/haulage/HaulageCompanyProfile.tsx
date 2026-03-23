import { useState, useEffect } from 'react';
import { Truck, Shield, MapPin, Calendar, Check, Phone, Mail, DollarSign, Award, Clock, Package, ChevronDown, ChevronUp, Building2, TrendingUp, User, CheckCircle, CreditCard, Wallet as WalletIcon, Settings, ShieldCheck, Bell, Globe, Copy, Users, RefreshCw, AlertTriangle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { HaulageFleetOverview } from './HaulageFleetOverview';
import { HaulagePerformanceAnalytics } from './HaulagePerformanceAnalytics';
import { PendingDriverApprovals } from './PendingDriverApprovals';

interface HaulageCompanyProfileProps {
  onNavigate: (path: string) => void;
}

export function HaulageCompanyProfile({ onNavigate }: HaulageCompanyProfileProps) {
  const { profile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'company' | 'performance' | 'fleet' | 'account' | 'settings' | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkedDriverCount, setLinkedDriverCount] = useState(0);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (profile?.id) {
      supabase
        .from('haulage_drivers')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', profile.id)
        .not('user_id', 'is', null)
        .then(({ count }) => {
          setLinkedDriverCount(count || 0);
        });
    }
  }, [profile?.id]);

  const handleCopyCode = async () => {
    const code = profile?.haulage_company_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = code;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleRegenerateCode = async () => {
    if (!profile) return;
    setRegenerating(true);

    try {
      const { data, error } = await supabase.rpc('generate_company_code' as string & keyof never);
      if (error) {
        showToast('Failed to generate new code. Please try again.', 'error');
        console.error('Generate code error:', error);
        return;
      }

      const newCode = typeof data === 'string' ? data : String(data);
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ haulage_company_code: newCode })
        .eq('id', profile.id);

      if (updateError) {
        showToast('Failed to save new code. Please try again.', 'error');
        console.error('Update code error:', updateError);
        return;
      }

      await refreshProfile();
      showToast('Company code regenerated successfully.', 'success');
    } catch (err) {
      console.error('Regenerate code error:', err);
      showToast('An error occurred. Please try again.', 'error');
    } finally {
      setRegenerating(false);
      setShowRegenerateConfirm(false);
    }
  };

  const [formData, setFormData] = useState({
    company_name: '',
    company_logo_url: '',
    business_registration: '',
    years_in_operation: '',
    insurance_status: 'None',
    insurance_expiry: '',
    operating_regions: [] as string[],
    cargo_specialties: [] as string[],
    insurance_certificate_url: '',
    cargo_insurance_amount: '',
    operating_license_number: '',
    operating_license_expiry: '',
    dot_number: '',
    safety_rating: '',
    service_hours: 'Business Hours',
    max_fleet_capacity_kg: '',
    equipment_types: [] as string[],
    payment_terms: 'Immediate',
    tax_id: '',
    billing_email: '',
    billing_phone: '',
    emergency_contact: '',
    dispatch_phone: '',
    preferred_contact_method: 'App',
    service_highlights: '',
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        company_name: profile.company_name || '',
        company_logo_url: profile.haulage_company_logo_url || '',
        business_registration: profile.haulage_business_registration || '',
        years_in_operation: profile.haulage_years_in_operation?.toString() || '',
        insurance_status: profile.haulage_insurance_status || 'None',
        insurance_expiry: profile.haulage_insurance_expiry || '',
        operating_regions: profile.haulage_operating_regions || [],
        cargo_specialties: profile.haulage_cargo_specialties || [],
        insurance_certificate_url: profile.haulage_insurance_certificate_url || '',
        cargo_insurance_amount: profile.haulage_cargo_insurance_amount?.toString() || '',
        operating_license_number: profile.haulage_operating_license_number || '',
        operating_license_expiry: profile.haulage_operating_license_expiry || '',
        dot_number: profile.haulage_dot_number || '',
        safety_rating: profile.haulage_safety_rating || '',
        service_hours: profile.haulage_service_hours || 'Business Hours',
        max_fleet_capacity_kg: profile.haulage_max_fleet_capacity_kg?.toString() || '',
        equipment_types: profile.haulage_equipment_types || [],
        payment_terms: profile.haulage_payment_terms || 'Immediate',
        tax_id: profile.haulage_tax_id || '',
        billing_email: profile.haulage_billing_email || '',
        billing_phone: profile.haulage_billing_phone || '',
        emergency_contact: profile.haulage_emergency_contact || '',
        dispatch_phone: profile.haulage_dispatch_phone || '',
        preferred_contact_method: profile.haulage_preferred_contact_method || 'App',
        service_highlights: profile.haulage_service_highlights || '',
      });
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          company_name: formData.company_name,
          haulage_company_logo_url: formData.company_logo_url,
          haulage_business_registration: formData.business_registration,
          haulage_years_in_operation: formData.years_in_operation ? parseInt(formData.years_in_operation) : null,
          haulage_insurance_status: formData.insurance_status,
          haulage_insurance_expiry: formData.insurance_expiry || null,
          haulage_operating_regions: formData.operating_regions,
          haulage_cargo_specialties: formData.cargo_specialties,
          haulage_insurance_certificate_url: formData.insurance_certificate_url || null,
          haulage_cargo_insurance_amount: formData.cargo_insurance_amount ? parseFloat(formData.cargo_insurance_amount) : null,
          haulage_operating_license_number: formData.operating_license_number || null,
          haulage_operating_license_expiry: formData.operating_license_expiry || null,
          haulage_dot_number: formData.dot_number || null,
          haulage_safety_rating: formData.safety_rating || null,
          haulage_service_hours: formData.service_hours,
          haulage_max_fleet_capacity_kg: formData.max_fleet_capacity_kg ? parseInt(formData.max_fleet_capacity_kg) : null,
          haulage_equipment_types: formData.equipment_types,
          haulage_payment_terms: formData.payment_terms,
          haulage_tax_id: formData.tax_id || null,
          haulage_billing_email: formData.billing_email || null,
          haulage_billing_phone: formData.billing_phone || null,
          haulage_emergency_contact: formData.emergency_contact || null,
          haulage_dispatch_phone: formData.dispatch_phone || null,
          haulage_preferred_contact_method: formData.preferred_contact_method,
          haulage_service_highlights: formData.service_highlights || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (error) throw error;

      await refreshProfile();
      setIsEditing(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Error saving company profile:', error);
      alert('Failed to save company profile');
    } finally {
      setSaving(false);
    }
  };

  const regions = ['North', 'South', 'East', 'West', 'Central', 'Tobago'];
  const specialties = ['General Cargo', 'Fragile Items', 'Refrigerated', 'Heavy Equipment', 'Hazardous Materials', 'Oversized Loads'];
  const equipmentTypes = ['Flatbed', 'Box Truck', 'Refrigerated', 'Tanker', 'Car Carrier', 'Heavy Hauler'];
  const contactMethods = ['App', 'SMS', 'Email', 'Phone'];

  const toggleSection = (section: 'company' | 'performance' | 'fleet' | 'account' | 'settings') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="space-y-4">
      {saved && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check className="w-5 h-5" />
          <span className="text-sm font-medium">Company information saved successfully</span>
        </div>
      )}

      {/* Driver Linking Code Card */}
      {profile?.haulage_company_code && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-slate-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-gray-900">Driver Linking Code</h3>
                <p className="text-[11px] text-gray-500">Drivers enter this at sign-up to join your fleet</p>
              </div>
              {linkedDriverCount > 0 && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-full flex-shrink-0">
                  {linkedDriverCount} linked
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex items-center justify-center">
                <span className="font-mono text-base font-bold tracking-widest text-gray-800">
                  {profile.haulage_company_code}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                  codeCopied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-moveme-blue-600 text-white hover:bg-moveme-blue-700'
                }`}
              >
                {codeCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {codeCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <button
              onClick={() => setShowRegenerateConfirm(true)}
              className="flex items-center gap-1 mt-2.5 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Regenerate code
            </button>
          </div>
        </div>
      )}

      <PendingDriverApprovals />

      {/* Company Information Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('company')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
              <p className="text-sm text-gray-600">Business details and operations</p>
            </div>
          </div>
          {expandedSection === 'company' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'company' && (
          <div className="px-6 pb-6 border-t border-gray-100">
            {!isEditing ? (
              <div className="space-y-6 mt-6">
                {formData.company_logo_url && (
                  <div className="flex justify-center mb-4">
                    <img
                      src={formData.company_logo_url}
                      alt="Company Logo"
                      className="h-20 w-auto object-contain"
                    />
                  </div>
                )}

                {/* 2x2 Grid of Information Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Company Profile - Blue */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-blue-900">Company Profile</h3>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-blue-700 mb-0.5">Company Name</p>
                        <p className="text-xs text-blue-900 font-semibold">
                          {formData.company_name || <span className="text-blue-400 italic">Not set</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-blue-700 mb-0.5">Business Reg #</p>
                        <p className="text-xs text-blue-900">
                          {formData.business_registration || <span className="text-blue-400 italic">Not set</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-blue-700 mb-0.5">Tax ID</p>
                        <p className="text-xs text-blue-900">
                          {formData.tax_id || <span className="text-blue-400 italic">Not set</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Compliance & Safety - Green */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-green-900">Compliance & Safety</h3>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-green-700 mb-0.5">Insurance Status</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${formData.insurance_status === 'Active' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                            {formData.insurance_status}
                          </span>
                          {formData.insurance_status === 'Active' && formData.insurance_expiry && (
                            <span className="text-xs text-green-700">
                              Exp: {new Date(formData.insurance_expiry).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-green-700 mb-0.5">Safety Rating</p>
                        <p className="text-xs text-green-900 font-semibold">
                          {formData.safety_rating || <span className="text-green-400 italic">Not rated</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-green-700 mb-0.5">Operating License</p>
                        <p className="text-xs text-green-900">
                          {formData.operating_license_number || <span className="text-green-400 italic">Not set</span>}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Operations & Fleet - Indigo */}
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Truck className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-indigo-900">Operations & Fleet</h3>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-indigo-700 mb-0.5">Operating Regions</p>
                        <div className="flex flex-wrap gap-1">
                          {formData.operating_regions.length > 0 ? (
                            formData.operating_regions.map((region) => (
                              <span key={region} className="px-1.5 py-0.5 bg-white text-indigo-700 text-xs font-medium rounded-full border border-indigo-200">
                                {region}
                              </span>
                            ))
                          ) : (
                            <span className="text-indigo-400 italic text-xs">Not set</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-indigo-700 mb-0.5">Equipment Types</p>
                        <div className="flex flex-wrap gap-1">
                          {formData.equipment_types.length > 0 ? (
                            formData.equipment_types.map((equipment) => (
                              <span key={equipment} className="px-1.5 py-0.5 bg-white text-indigo-700 text-xs font-medium rounded-full border border-indigo-200">
                                {equipment}
                              </span>
                            ))
                          ) : (
                            <span className="text-indigo-400 italic text-xs">Not set</span>
                          )}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-indigo-700 mb-0.5">Service Hours</p>
                        <p className="text-xs text-indigo-900 font-semibold">{formData.service_hours}</p>
                      </div>
                    </div>
                  </div>

                  {/* Contact Center - Orange */}
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Phone className="w-4 h-4 text-white" />
                      </div>
                      <h3 className="text-xs font-bold text-orange-900">Contact Center</h3>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-orange-700 mb-0.5">Emergency Contact</p>
                        <p className="text-xs text-orange-900 font-semibold">
                          {formData.emergency_contact || <span className="text-orange-400 italic">Not set</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-orange-700 mb-0.5">Dispatch Phone</p>
                        <p className="text-xs text-orange-900">
                          {formData.dispatch_phone || <span className="text-orange-400 italic">Not set</span>}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-orange-700 mb-0.5">Preferred Method</p>
                        <p className="text-xs text-orange-900 font-semibold">{formData.preferred_contact_method}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Edit Button */}
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium"
                >
                  Edit Company Information
                </button>
              </div>
            ) : (
              <div className="space-y-8 mt-6">
                {formData.company_logo_url && (
                  <div className="flex justify-center mb-4">
                    <img
                      src={formData.company_logo_url}
                      alt="Company Logo"
                      className="h-20 w-auto object-contain"
                    />
                  </div>
                )}

                {/* Company Overview Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-2">Company Overview</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter company name"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Registration Number
                    </label>
                    <input
                      type="text"
                      value={formData.business_registration}
                      onChange={(e) => setFormData({ ...formData, business_registration: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter registration number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Tax ID
                    </label>
                    <input
                      type="text"
                      value={formData.tax_id}
                      onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter tax identification number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Years in Operation
                    </label>
                    <input
                      type="number"
                      value={formData.years_in_operation}
                      onChange={(e) => setFormData({ ...formData, years_in_operation: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Highlights
                    </label>
                    <textarea
                      value={formData.service_highlights}
                      onChange={(e) => setFormData({ ...formData, service_highlights: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Briefly describe your unique services and strengths..."
                      rows={3}
                    />
                  </div>
                </div>

                {/* Insurance & Compliance Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-2 flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Insurance & Compliance
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Insurance Status
                    </label>
                    <div className="space-y-2">
                      <select
                        value={formData.insurance_status}
                        onChange={(e) => setFormData({ ...formData, insurance_status: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        <option value="None">None</option>
                        <option value="Active">Active</option>
                        <option value="Expired">Expired</option>
                      </select>
                      {formData.insurance_status === 'Active' && (
                        <>
                          <input
                            type="date"
                            value={formData.insurance_expiry}
                            onChange={(e) => setFormData({ ...formData, insurance_expiry: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Expiry date"
                          />
                          <input
                            type="url"
                            value={formData.insurance_certificate_url}
                            onChange={(e) => setFormData({ ...formData, insurance_certificate_url: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Certificate URL (optional)"
                          />
                        </>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cargo Insurance Coverage (TTD)
                    </label>
                    <input
                      type="number"
                      value={formData.cargo_insurance_amount}
                      onChange={(e) => setFormData({ ...formData, cargo_insurance_amount: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operating License Number
                    </label>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={formData.operating_license_number}
                        onChange={(e) => setFormData({ ...formData, operating_license_number: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="License number"
                      />
                      <input
                        type="date"
                        value={formData.operating_license_expiry}
                        onChange={(e) => setFormData({ ...formData, operating_license_expiry: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Expiry date"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      DOT / Regulatory ID
                    </label>
                    <input
                      type="text"
                      value={formData.dot_number}
                      onChange={(e) => setFormData({ ...formData, dot_number: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Department of Transportation ID"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Safety Rating
                    </label>
                    <select
                      value={formData.safety_rating}
                      onChange={(e) => setFormData({ ...formData, safety_rating: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="">Not Rated</option>
                      <option value="Excellent">Excellent</option>
                      <option value="Good">Good</option>
                      <option value="Satisfactory">Satisfactory</option>
                      <option value="Needs Improvement">Needs Improvement</option>
                    </select>
                  </div>
                </div>

                {/* Operations & Capabilities Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Operations & Capabilities
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Hours
                    </label>
                    <select
                      value={formData.service_hours}
                      onChange={(e) => setFormData({ ...formData, service_hours: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Business Hours">Business Hours (8am-5pm)</option>
                      <option value="Extended Hours">Extended Hours (6am-10pm)</option>
                      <option value="24/7">24/7 Available</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maximum Fleet Capacity (kg)
                    </label>
                    <input
                      type="number"
                      value={formData.max_fleet_capacity_kg}
                      onChange={(e) => setFormData({ ...formData, max_fleet_capacity_kg: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Total capacity across all vehicles"
                      min="0"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Equipment Types Available
                    </label>
                    <div className="space-y-2">
                      {equipmentTypes.map((equipment) => (
                        <label key={equipment} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.equipment_types.includes(equipment)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, equipment_types: [...formData.equipment_types, equipment] });
                              } else {
                                setFormData({ ...formData, equipment_types: formData.equipment_types.filter(e => e !== equipment) });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{equipment}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Operating Regions
                    </label>
                    <div className="space-y-2">
                      {regions.map((region) => (
                        <label key={region} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.operating_regions.includes(region)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, operating_regions: [...formData.operating_regions, region] });
                              } else {
                                setFormData({ ...formData, operating_regions: formData.operating_regions.filter(r => r !== region) });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{region}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Cargo Specialties
                    </label>
                    <div className="space-y-2">
                      {specialties.map((specialty) => (
                        <label key={specialty} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={formData.cargo_specialties.includes(specialty)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormData({ ...formData, cargo_specialties: [...formData.cargo_specialties, specialty] });
                              } else {
                                setFormData({ ...formData, cargo_specialties: formData.cargo_specialties.filter(s => s !== specialty) });
                              }
                            }}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                          <span className="text-sm text-gray-700">{specialty}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Contact Information Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-2 flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Contact Information
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Emergency Contact (24/7)
                    </label>
                    <input
                      type="tel"
                      value={formData.emergency_contact}
                      onChange={(e) => setFormData({ ...formData, emergency_contact: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+1 (868) 555-0123"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Dispatch Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.dispatch_phone}
                      onChange={(e) => setFormData({ ...formData, dispatch_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+1 (868) 555-0123"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Contact Method
                    </label>
                    <select
                      value={formData.preferred_contact_method}
                      onChange={(e) => setFormData({ ...formData, preferred_contact_method: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {contactMethods.map((method) => (
                        <option key={method} value={method}>{method}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Business & Billing Section */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide border-b pb-2 flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Business & Billing
                  </h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Terms
                    </label>
                    <select
                      value={formData.payment_terms}
                      onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Immediate">Immediate Payment</option>
                      <option value="NET 7">NET 7 Days</option>
                      <option value="NET 15">NET 15 Days</option>
                      <option value="NET 30">NET 30 Days</option>
                      <option value="NET 60">NET 60 Days</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Billing Email
                    </label>
                    <input
                      type="email"
                      value={formData.billing_email}
                      onChange={(e) => setFormData({ ...formData, billing_email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="billing@company.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Billing Phone
                    </label>
                    <input
                      type="tel"
                      value={formData.billing_phone}
                      onChange={(e) => setFormData({ ...formData, billing_phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+1 (868) 555-0123"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      if (profile) {
                        setFormData({
                          company_name: profile.company_name || '',
                          company_logo_url: profile.haulage_company_logo_url || '',
                          business_registration: profile.haulage_business_registration || '',
                          years_in_operation: profile.haulage_years_in_operation?.toString() || '',
                          insurance_status: profile.haulage_insurance_status || 'None',
                          insurance_expiry: profile.haulage_insurance_expiry || '',
                          operating_regions: profile.haulage_operating_regions || [],
                          cargo_specialties: profile.haulage_cargo_specialties || [],
                          insurance_certificate_url: profile.haulage_insurance_certificate_url || '',
                          cargo_insurance_amount: profile.haulage_cargo_insurance_amount?.toString() || '',
                          operating_license_number: profile.haulage_operating_license_number || '',
                          operating_license_expiry: profile.haulage_operating_license_expiry || '',
                          dot_number: profile.haulage_dot_number || '',
                          safety_rating: profile.haulage_safety_rating || '',
                          service_hours: profile.haulage_service_hours || 'Business Hours',
                          max_fleet_capacity_kg: profile.haulage_max_fleet_capacity_kg?.toString() || '',
                          equipment_types: profile.haulage_equipment_types || [],
                          payment_terms: profile.haulage_payment_terms || 'Immediate',
                          tax_id: profile.haulage_tax_id || '',
                          billing_email: profile.haulage_billing_email || '',
                          billing_phone: profile.haulage_billing_phone || '',
                          emergency_contact: profile.haulage_emergency_contact || '',
                          dispatch_phone: profile.haulage_dispatch_phone || '',
                          preferred_contact_method: profile.haulage_preferred_contact_method || 'App',
                          service_highlights: profile.haulage_service_highlights || '',
                        });
                      }
                    }}
                    disabled={saving}
                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Company Performance Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('performance')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-gray-900">Company Performance</h2>
              <p className="text-sm text-gray-600">Metrics and analytics</p>
            </div>
          </div>
          {expandedSection === 'performance' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'performance' && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div className="mt-6">
              <HaulagePerformanceAnalytics />
            </div>
          </div>
        )}
      </div>

      {/* Fleet Overview Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('fleet')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-gray-900">Fleet Overview</h2>
              <p className="text-sm text-gray-600">Manage vehicles and drivers</p>
            </div>
          </div>
          {expandedSection === 'fleet' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'fleet' && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div className="mt-6">
              <HaulageFleetOverview />
            </div>
          </div>
        )}
      </div>

      {/* Account Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('account')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-gray-900">Account</h2>
              <p className="text-sm text-gray-600">Profile and settings</p>
            </div>
          </div>
          {expandedSection === 'account' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'account' && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div className="space-y-6 mt-6">
              {/* 2x2 Grid of Account Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Edit Profile - Green */}
                <button
                  onClick={() => {
                    setExpandedSection('company');
                    setIsEditing(true);
                  }}
                  className="bg-green-50 border border-green-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-green-900">Edit Profile</h3>
                    </div>
                  </div>
                  <p className="text-xs text-green-700">Update personal info</p>
                </button>

                {/* Address Book - Blue */}
                <button
                  onClick={() => onNavigate('/address-book')}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MapPin className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-blue-900">Address Book</h3>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700">Manage saved addresses</p>
                </button>

                {/* Payment Methods - Yellow */}
                <button
                  onClick={() => onNavigate('/payment-methods')}
                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-yellow-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CreditCard className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-yellow-900">Payment Methods</h3>
                    </div>
                  </div>
                  <p className="text-xs text-yellow-700">Manage cards</p>
                </button>

                {/* Verification - Teal */}
                <button
                  onClick={() => onNavigate('/verification')}
                  className="bg-teal-50 border border-teal-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-teal-900">Verification</h3>
                    </div>
                  </div>
                  <p className="text-xs text-teal-700">Identity confirmed</p>
                </button>
              </div>

              {/* Wallet - Full Width Purple Card */}
              <button
                onClick={() => onNavigate('/wallet')}
                className="w-full bg-purple-50 border border-purple-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                    <WalletIcon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-purple-900">Wallet</h3>
                    <p className="text-xs text-purple-700">View balance and transactions</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-purple-400 flex-shrink-0 transform -rotate-90" />
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Settings Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <button
          onClick={() => toggleSection('settings')}
          className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div className="text-left">
              <h2 className="text-lg font-semibold text-gray-900">Settings</h2>
              <p className="text-sm text-gray-600">App preferences and configuration</p>
            </div>
          </div>
          {expandedSection === 'settings' ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </button>

        {expandedSection === 'settings' && (
          <div className="px-6 pb-6 border-t border-gray-100">
            <div className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Settings - Blue */}
                <button
                  onClick={() => onNavigate('/settings')}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Settings className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-blue-900">Settings</h3>
                    </div>
                  </div>
                  <p className="text-xs text-blue-700">App preferences</p>
                </button>

                {/* Notifications - Green */}
                <button
                  onClick={() => onNavigate('/settings/notifications')}
                  className="bg-green-50 border border-green-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Bell className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-green-900">Notifications</h3>
                    </div>
                  </div>
                  <p className="text-xs text-green-700">Manage notification preferences</p>
                </button>

                {/* Language - Indigo */}
                <button
                  onClick={() => onNavigate('/settings/language')}
                  className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Globe className="w-4 h-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-indigo-900">Language</h3>
                    </div>
                  </div>
                  <p className="text-xs text-indigo-700">English (Trinidad & Tobago)</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showRegenerateConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-fade-in-up">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Regenerate Code?</h3>
              </div>
              <p className="text-sm text-gray-600 leading-relaxed">
                Regenerating the code will invalidate the current one. Any drivers who haven't linked yet will need the new code.
              </p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                disabled={regenerating}
                className="flex-1 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors border-r border-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateCode}
                disabled={regenerating}
                className="flex-1 py-3.5 text-sm font-semibold text-amber-600 hover:bg-amber-50 transition-colors disabled:opacity-50"
              >
                {regenerating ? 'Regenerating...' : 'Regenerate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
          <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border ${
            toastMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-800'
              : 'bg-red-50 border-red-200 text-red-800'
          }`}>
            {toastMessage.type === 'success' ? (
              <Check className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <span className="text-sm font-medium">{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="ml-1 p-0.5 hover:opacity-70">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
