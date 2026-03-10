import { useAuth } from '../../contexts/AuthContext';
import { ProfileHeader } from '../../components/ProfileHeader';
import { ProfileQuickActions } from '../../components/ProfileQuickActions';
import { CustomerProfileActivitySummary } from '../../components/customer/CustomerProfileActivitySummary';
import { CustomerProfileRecentDeliveries } from '../../components/customer/CustomerProfileRecentDeliveries';
import { CustomerProfileLoyalty } from '../../components/customer/CustomerProfileLoyalty';
import { CustomerProfileReferral } from '../../components/customer/CustomerProfileReferral';
import { CustomerProfileMenuSections } from '../../components/customer/CustomerProfileMenuSections';

interface CustomerProfileProps {
  onNavigate: (path: string) => void;
}

export function CustomerProfile({ onNavigate }: CustomerProfileProps) {
  const { user, profile, signOut } = useAuth();

  if (!profile || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <ProfileHeader
        fullName={profile.full_name}
        email={profile.email}
        accountType="customer"
        isVerified={true}
        hideVerificationBadge
        profilePictureUrl={profile.avatar_url}
        userId={user.id}
        uploadField="avatar_url"
        onUploadComplete={() => window.location.reload()}
      />

      <div className="space-y-6 -mt-2">
        <ProfileQuickActions onNavigate={onNavigate} />

        <CustomerProfileActivitySummary
          userId={user.id}
          memberSince={profile.created_at}
        />

        <CustomerProfileRecentDeliveries
          userId={user.id}
          onNavigate={onNavigate}
        />

        <CustomerProfileLoyalty userId={user.id} />

        <CustomerProfileReferral userId={user.id} />

        <CustomerProfileMenuSections
          onNavigate={onNavigate}
          onLogout={signOut}
        />
      </div>
    </div>
  );
}
