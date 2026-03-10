import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Loader2, Home, MapPin, TrendingUp } from 'lucide-react';
import { Database } from '../../lib/database.types';
import { SetHomeBaseModal } from '../../components/SetHomeBaseModal';
import { ProfileHeader } from '../../components/ProfileHeader';
import { ProfileQuickActions } from '../../components/ProfileQuickActions';
import { ProfileMenuSections } from '../../components/ProfileMenuSections';
import { HaulageCompanyProfile } from '../../components/haulage/HaulageCompanyProfile';
import { HaulageFleetOverview } from '../../components/haulage/HaulageFleetOverview';
import { HaulageDriverRoster } from '../../components/haulage/HaulageDriverRoster';
import { HaulageVehicleRoster } from '../../components/haulage/HaulageVehicleRoster';
import { HaulagePerformanceAnalytics } from '../../components/haulage/HaulagePerformanceAnalytics';
import { CompanyDriverInfo } from '../../components/courier/CompanyDriverInfo';

type Courier = Database['public']['Tables']['couriers']['Row'];

interface CourierProfileProps {
  onNavigate: (path: string) => void;
}

export function CourierProfile({ onNavigate }: CourierProfileProps) {
  const { profile, user, signOut } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHomeBaseModal, setShowHomeBaseModal] = useState(false);

  useEffect(() => {
    fetchCourierData();
  }, []);

  const fetchCourierData = async () => {
    try {
      const { data, error } = await supabase
        .from('couriers')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      setCourier(data);
    } catch (error) {
      console.error('Error fetching courier data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHomeBase = async (location: { text: string; lat: number; lng: number }) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          home_base_location_text: location.text,
          home_base_lat: location.lat,
          home_base_lng: location.lng,
        })
        .eq('id', user!.id);

      if (error) throw error;

      alert('Home base location saved successfully!');
      window.location.reload();
    } catch (error) {
      console.error('Error saving home base:', error);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center pb-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const isHaulageCompany = profile.role === 'business' && profile.business_type === 'haulage';
  const isCompanyDriver = !!(profile as any).is_company_driver;
  const isVerified = isHaulageCompany
    ? profile.business_verification_status === 'approved'
    : courier?.verification_status === 'approved';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <ProfileHeader
        fullName={isHaulageCompany ? (profile.company_name || profile.full_name) : profile.full_name}
        email={isHaulageCompany ? (profile.company_email || profile.email) : profile.email}
        accountType={isHaulageCompany ? 'haulage' : isCompanyDriver ? 'company_driver' : 'courier'}
        isVerified={isVerified}
        profilePictureUrl={profile.avatar_url}
      />

      <ProfileQuickActions onNavigate={onNavigate} hideFinancial={isCompanyDriver} />

      {isCompanyDriver && courier && (
        <CompanyDriverInfo courierId={courier.id} onNavigate={onNavigate} />
      )}

      {!isHaulageCompany && !isCompanyDriver && (
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="bg-indigo-100 rounded-full p-3 flex-shrink-0">
                <Home className="w-6 h-6 text-indigo-600" />
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-gray-900 text-lg">Backhaul Matching</h3>
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded-full">
                    NEW
                  </span>
                </div>

                <div className="flex items-start gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700">
                    Set your home base and we'll notify you of return trip opportunities,
                    so you can earn money instead of driving home empty!
                  </p>
                </div>

                {profile?.home_base_location_text ? (
                  <div className="bg-white/60 rounded-lg p-3 mb-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Your Home Base</p>
                        <p className="text-sm text-gray-900 font-medium">
                          {profile.home_base_location_text}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                    <p className="text-xs text-amber-800 font-medium">
                      No home base set yet. Set one now to start finding return trips!
                    </p>
                  </div>
                )}

                <button
                  onClick={() => setShowHomeBaseModal(true)}
                  className="w-full bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg hover:bg-indigo-700 transition-colors shadow-md"
                >
                  {profile?.home_base_location_text ? 'Update Home Base' : 'Set Home Base'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {isHaulageCompany && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <HaulageCompanyProfile />
          <HaulagePerformanceAnalytics />
          <HaulageFleetOverview />
          <HaulageDriverRoster />
          <HaulageVehicleRoster />
        </div>
      )}

      <ProfileMenuSections onNavigate={onNavigate} onLogout={signOut} />

      {/* NEW: Home Base Modal */}
      <SetHomeBaseModal
        isOpen={showHomeBaseModal}
        onClose={() => setShowHomeBaseModal(false)}
        onSave={handleSaveHomeBase}
        currentHomeBase={profile?.home_base_location_text || undefined}
      />
    </div>
  );
}
