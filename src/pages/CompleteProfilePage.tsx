import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, Truck, Store, LogOut } from 'lucide-react';

export function CompleteProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [companyName, setCompanyName] = useState(profile?.company_name || '');
  const [companyEmail, setCompanyEmail] = useState(profile?.company_email || '');
  const [companyAddress, setCompanyAddress] = useState(profile?.company_address || '');
  const [businessType, setBusinessType] = useState<'haulage' | 'retail' | ''>(profile?.business_type || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const isBusiness = profile?.role === 'business';

  // Update form when profile loads
  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name || '');
      setLastName(profile.last_name || '');
      setPhone(profile.phone || '');
      setCompanyName(profile.company_name || '');
      setCompanyEmail(profile.company_email || '');
      setCompanyAddress(profile.company_address || '');
      setBusinessType(profile.business_type || '');
    }
  }, [profile]);

  const handleBack = async () => {
    await supabase.auth.signOut();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('Starting profile update...');
      const fullName = `${firstName} ${lastName}`.trim();

      const updateData: any = {
        first_name: firstName,
        last_name: lastName,
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString(),
      };

      if (isBusiness) {
        if (companyName) updateData.company_name = companyName;
        if (companyEmail) updateData.company_email = companyEmail;
        if (companyAddress) updateData.company_address = companyAddress;
        if (businessType) {
          updateData.business_type = businessType;
          if (businessType === 'retail') {
            updateData.business_verification_status = 'approved';
            updateData.business_verified = true;
          } else {
            updateData.business_verification_status = 'pending';
            updateData.business_verified = false;
          }
        } else if (profile?.business_type) {
          // Keep existing business_type if not changing it
          updateData.business_type = profile.business_type;
        }
      }

      console.log('Update data:', updateData);
      console.log('User ID:', user?.id);

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user!.id)
        .select();

      console.log('Update result:', { data, error: updateError });

      if (updateError) throw updateError;

      console.log('Refreshing profile...');
      await refreshProfile();
      console.log('Profile refreshed successfully');
    } catch (err: unknown) {
      console.error('Profile update error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while updating profile');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-moveme-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <button
          onClick={handleBack}
          className="mb-4 flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="text-sm font-medium">Sign Out</span>
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Complete Your Profile
          </h1>
          <p className="text-gray-600">
            {isBusiness ? 'Tell us about your business' : "Let's get to know you better"}
          </p>
        </div>

        {isBusiness && !businessType && !profile?.business_type && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">What type of business are you?</h2>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => setBusinessType('haulage')}
                className="p-6 border-2 border-gray-200 rounded-xl hover:border-moveme-blue-500 hover:bg-moveme-blue-50 transition-all text-center group"
              >
                <Truck className="w-12 h-12 mx-auto mb-3 text-gray-600 group-hover:text-moveme-blue-600" />
                <h3 className="font-semibold text-gray-900 mb-1">Haulage Company</h3>
                <p className="text-sm text-gray-600">Accept and bid on delivery jobs</p>
              </button>

              <button
                type="button"
                onClick={() => setBusinessType('retail')}
                className="p-6 border-2 border-gray-200 rounded-xl hover:border-moveme-blue-500 hover:bg-moveme-blue-50 transition-all text-center group"
              >
                <Store className="w-12 h-12 mx-auto mb-3 text-gray-600 group-hover:text-moveme-blue-600" />
                <h3 className="font-semibold text-gray-900 mb-1">Retail Business</h3>
                <p className="text-sm text-gray-600">Post delivery jobs for your business</p>
              </button>
            </div>
          </div>
        )}

        {(!isBusiness || businessType) && (
          <>
            {isBusiness && businessType && (
              <div className="mb-4 p-4 bg-moveme-blue-50 border border-moveme-blue-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {businessType === 'haulage' ? <Truck className="w-5 h-5 text-moveme-blue-600" /> : <Store className="w-5 h-5 text-moveme-blue-600" />}
                  <span className="font-medium text-gray-900">
                    {businessType === 'haulage' ? 'Haulage Company' : 'Retail Business'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setBusinessType('')}
                  className="text-sm text-moveme-blue-600 hover:text-moveme-blue-700 font-medium"
                >
                  Change
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name <span className="text-red-500">*</span>
                </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="John"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Last Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Doe"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isBusiness ? 'Contact Number' : 'Phone Number'} <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="868-123-4567"
              required
            />
          </div>

          {isBusiness && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Name {!profile?.company_name && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Acme Corp"
                  required={!profile?.company_name}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Email {!profile?.company_email && <span className="text-red-500">*</span>}
                </label>
                <input
                  type="email"
                  value={companyEmail}
                  onChange={(e) => setCompanyEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="contact@acmecorp.com"
                  required={!profile?.company_email}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Company Address {!profile?.company_address && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  value={companyAddress}
                  onChange={(e) => setCompanyAddress(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="123 Main Street, Port of Spain"
                  rows={3}
                  required={!profile?.company_address}
                />
              </div>
            </>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            {loading ? 'Saving...' : 'Continue'}
          </button>
        </form>
          </>
        )}

        {profile?.role === 'courier' && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-gray-700">
              After completing your profile, you'll need to complete courier verification to start accepting jobs.
            </p>
          </div>
        )}

        {isBusiness && (
          <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-gray-700">
              Your business account will be reviewed by our admin team. You'll be notified once your account is verified and approved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
