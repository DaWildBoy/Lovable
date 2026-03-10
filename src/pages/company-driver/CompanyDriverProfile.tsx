import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import { Database } from '../../lib/database.types';
import { ProfileHeader } from '../../components/ProfileHeader';
import { CompanyDriverInfo } from '../../components/courier/CompanyDriverInfo';
import { ProfileMenuSections } from '../../components/ProfileMenuSections';

type Courier = Database['public']['Tables']['couriers']['Row'];

interface CompanyDriverProfileProps {
  onNavigate: (path: string) => void;
}

export function CompanyDriverProfile({ onNavigate }: CompanyDriverProfileProps) {
  const { profile, user, signOut } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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

      const linkedCompanyId = (profile as any)?.linked_company_id;
      if (linkedCompanyId) {
        const { data: companyProfile } = await supabase
          .from('profiles')
          .select('company_name, full_name')
          .eq('id', linkedCompanyId)
          .maybeSingle();

        setCompanyName(companyProfile?.company_name || companyProfile?.full_name || null);
      }
    } catch (error) {
      console.error('Error fetching courier data:', error);
    } finally {
      setLoading(false);
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

  const isVerified = courier?.verification_status === 'approved';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <ProfileHeader
        fullName={profile.full_name}
        email={profile.email}
        accountType="company_driver"
        isVerified={isVerified}
        profilePictureUrl={profile.avatar_url}
        companyName={companyName}
      />

      {courier && (
        <CompanyDriverInfo courierId={courier.id} onNavigate={onNavigate} />
      )}

      <ProfileMenuSections onNavigate={onNavigate} onLogout={signOut} />
    </div>
  );
}
