import { useState, useEffect } from 'react';
import { Building2, Mail, Phone, User, Upload, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface RetailCompanyProfileProps {
  embedded?: boolean;
}

export function RetailCompanyProfile({ embedded = false }: RetailCompanyProfileProps) {
  const { profile, refreshProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [primaryContact, setPrimaryContact] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    if (profile) {
      setCompanyName(profile.company_name || '');
      setBusinessType(profile.business_type || '');
      setPrimaryContact(profile.retail_primary_contact_name || '');
      setBusinessPhone(profile.retail_business_phone || '');
      setBusinessEmail(profile.retail_business_email || '');
      setLogoUrl(profile.retail_company_logo_url || '');
    }
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          company_name: companyName,
          business_type: businessType,
          retail_primary_contact_name: primaryContact,
          retail_business_phone: businessPhone,
          retail_business_email: businessEmail,
          retail_company_logo_url: logoUrl,
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

  const businessTypes = [
    'Retail Store',
    'Distributor',
    'Warehouse',
    'Supermarket',
    'E-commerce',
    'Wholesaler',
    'Restaurant Chain',
    'Pharmacy Chain',
    'Other Retail',
  ];

  const content = (
    <>
      {!embedded && (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Company Information</h2>
              <p className="text-sm text-gray-600">Manage your retail business profile</p>
            </div>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
            >
              Edit
            </button>
          )}
        </div>
      )}
      {embedded && !isEditing && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => setIsEditing(true)}
            className="px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
          >
            Edit
          </button>
        </div>
      )}

      {saved && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2 text-green-700">
          <Check className="w-5 h-5" />
          <span className="text-sm font-medium">Company information saved successfully</span>
        </div>
      )}

      <div className="space-y-4">
        {logoUrl && (
          <div className="flex justify-center mb-4">
            <img
              src={logoUrl}
              alt="Company Logo"
              className="h-20 w-auto object-contain"
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Company Name
          </label>
          {isEditing ? (
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter company name"
            />
          ) : (
            <div className="flex items-center gap-2 text-gray-900">
              <Building2 className="w-4 h-4 text-gray-400" />
              {companyName || <span className="text-gray-400 italic">Not set</span>}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Type
          </label>
          {isEditing ? (
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select business type</option>
              {businessTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-gray-900">
              {businessType || <span className="text-gray-400 italic">Not set</span>}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Primary Contact Name
          </label>
          {isEditing ? (
            <input
              type="text"
              value={primaryContact}
              onChange={(e) => setPrimaryContact(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter primary contact name"
            />
          ) : (
            <div className="flex items-center gap-2 text-gray-900">
              <User className="w-4 h-4 text-gray-400" />
              {primaryContact || <span className="text-gray-400 italic">Not set</span>}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Phone
          </label>
          {isEditing ? (
            <input
              type="tel"
              value={businessPhone}
              onChange={(e) => setBusinessPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter business phone"
            />
          ) : (
            <div className="flex items-center gap-2 text-gray-900">
              <Phone className="w-4 h-4 text-gray-400" />
              {businessPhone || <span className="text-gray-400 italic">Not set</span>}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Business Email
          </label>
          {isEditing ? (
            <input
              type="email"
              value={businessEmail}
              onChange={(e) => setBusinessEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter business email"
            />
          ) : (
            <div className="flex items-center gap-2 text-gray-900">
              <Mail className="w-4 h-4 text-gray-400" />
              {businessEmail || <span className="text-gray-400 italic">Not set</span>}
            </div>
          )}
        </div>

        {isEditing && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Company Logo URL
            </label>
            <div className="flex gap-2">
              <input
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter logo image URL"
              />
              <button className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Enter a URL to your company logo image
            </p>
          </div>
        )}

        {isEditing && (
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
                  setCompanyName(profile.company_name || '');
                  setBusinessType(profile.business_type || '');
                  setPrimaryContact(profile.retail_primary_contact_name || '');
                  setBusinessPhone(profile.retail_business_phone || '');
                  setBusinessEmail(profile.retail_business_email || '');
                  setLogoUrl(profile.retail_company_logo_url || '');
                }
              }}
              disabled={saving}
              className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </>
  );

  if (embedded) {
    return <div>{content}</div>;
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      {content}
    </div>
  );
}
