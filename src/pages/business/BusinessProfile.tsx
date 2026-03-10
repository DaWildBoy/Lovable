import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { ProfileHeader } from '../../components/ProfileHeader';
import { ProfileQuickActions } from '../../components/ProfileQuickActions';
import { ProfileMenuSections } from '../../components/ProfileMenuSections';
import { RetailCompanyProfile } from '../../components/retail/RetailCompanyProfile';
import { RetailSavedLocations } from '../../components/retail/RetailSavedLocations';
import { RetailAnalytics } from '../../components/retail/RetailAnalytics';
import { RetailPreferredCouriers } from '../../components/retail/RetailPreferredCouriers';
import { RetailDeliveryTemplates } from '../../components/retail/RetailDeliveryTemplates';
import { HaulageCompanyProfile } from '../../components/haulage/HaulageCompanyProfile';

interface BusinessProfileProps {
  onNavigate: (path: string) => void;
}

export function BusinessProfile({ onNavigate }: BusinessProfileProps) {
  const { profile, signOut, refreshProfile } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  if (!profile) return null;

  const isVerified = profile.business_verification_status === 'approved';
  const accountType = profile.business_type === 'haulage' ? 'haulage' : 'retail';
  const isRetail = accountType === 'retail';
  const isHaulage = accountType === 'haulage';

  const displayLogo = logoUrl || profile.haulage_company_logo_url || profile.avatar_url;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <ProfileHeader
        fullName={profile.company_name || profile.full_name}
        email={profile.company_email || profile.email}
        accountType={accountType}
        isVerified={isVerified}
        profilePictureUrl={isHaulage ? displayLogo : profile.avatar_url}
        userId={isHaulage ? profile.id : undefined}
        uploadField={isHaulage ? 'haulage_company_logo_url' : undefined}
        onUploadComplete={isHaulage ? (url) => { setLogoUrl(url); refreshProfile(); } : undefined}
      />

      <ProfileQuickActions onNavigate={onNavigate} />

      {isRetail && (
        <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
          <RetailCompanyProfile />
          <RetailAnalytics />
          <RetailSavedLocations />
          <RetailDeliveryTemplates />
          <RetailPreferredCouriers />
        </div>
      )}

      {isHaulage && (
        <div className="max-w-4xl mx-auto px-4 py-6">
          <HaulageCompanyProfile onNavigate={onNavigate} />
        </div>
      )}

      <ProfileMenuSections onNavigate={onNavigate} onLogout={signOut} showSubscription />
    </div>
  );
}
