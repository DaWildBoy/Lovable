import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Loader2, User, CheckCircle, Star, Package, Wallet, ChevronRight, Truck, MapPin, CreditCard, CircleUser as UserCircle, FileText, Gift, MessageCircle, LogOut, LifeBuoy, Camera, Home, TrendingUp } from 'lucide-react';
import { Database } from '../../lib/database.types';
import { SetHomeBaseModal } from '../../components/SetHomeBaseModal';
import { HaulageCompanyProfile } from '../../components/haulage/HaulageCompanyProfile';
import { HaulageFleetOverview } from '../../components/haulage/HaulageFleetOverview';
import { HaulageDriverRoster } from '../../components/haulage/HaulageDriverRoster';
import { HaulageVehicleRoster } from '../../components/haulage/HaulageVehicleRoster';
import { HaulagePerformanceAnalytics } from '../../components/haulage/HaulagePerformanceAnalytics';
import { CompanyDriverInfo } from '../../components/courier/CompanyDriverInfo';
import { ReferralDashboard } from '../../components/ReferralDashboard';
import { CourierTermsOfServiceModal } from '../../components/CourierTermsOfServiceModal';

type Courier = Database['public']['Tables']['couriers']['Row'];

interface CourierProfileProps {
  onNavigate: (path: string) => void;
}

export function CourierProfile({ onNavigate }: CourierProfileProps) {
  const { profile, user, signOut } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [loading, setLoading] = useState(true);
  const [showHomeBaseModal, setShowHomeBaseModal] = useState(false);
  const [showCourierTerms, setShowCourierTerms] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/') || file.size > 5 * 1024 * 1024) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user.id}-${Date.now()}.${fileExt}`;
      const { error: uploadErr } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      window.location.reload();
    } catch (err) {
      console.error('Error uploading avatar:', err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center pb-16">
        <Loader2 className="w-8 h-8 text-moveme-blue-600 animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  const isHaulageCompany = profile.role === 'business' && profile.business_type === 'haulage';
  const isCompanyDriver = !!(profile as any).is_company_driver;
  const isVerified = isHaulageCompany
    ? profile.business_verification_status === 'approved'
    : courier?.verification_status === 'approved';

  if (isHaulageCompany) {
    return (
      <HaulageProfileLayout
        profile={profile}
        onNavigate={onNavigate}
        signOut={signOut}
      />
    );
  }

  const rating = courier?.rating_average ?? 0;
  const deliveries = courier?.completed_deliveries ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-8">
      <div className="max-w-lg mx-auto">
        <CourierIdentityHeader
          fullName={profile.full_name}
          avatarUrl={profile.avatar_url}
          isVerified={!!isVerified}
          rating={rating}
          deliveries={deliveries}
          uploading={uploading}
          fileInputRef={fileInputRef}
          onAvatarClick={() => fileInputRef.current?.click()}
          onFileChange={handleAvatarUpload}
        />

        {isCompanyDriver && courier && (
          <div className="px-4 mt-4">
            <CompanyDriverInfo courierId={courier.id} onNavigate={onNavigate} />
          </div>
        )}

        <WalletCard onNavigate={onNavigate} />

        {!isCompanyDriver && (
          <BackhaulCard
            homeBase={profile.home_base_location_text}
            onSetHomeBase={() => setShowHomeBaseModal(true)}
          />
        )}

        <CourierMenuGroups
          onNavigate={onNavigate}
          onLogout={signOut}
          onShowTerms={() => setShowCourierTerms(true)}
          isCompanyDriver={isCompanyDriver}
        />

        {!isCompanyDriver && user && (
          <div className="mt-2 pb-2">
            <ReferralDashboard userId={user.id} role="courier" />
          </div>
        )}
      </div>

      <SetHomeBaseModal
        isOpen={showHomeBaseModal}
        onClose={() => setShowHomeBaseModal(false)}
        onSave={handleSaveHomeBase}
        currentHomeBase={profile?.home_base_location_text || undefined}
      />
      <CourierTermsOfServiceModal
        open={showCourierTerms}
        onClose={() => setShowCourierTerms(false)}
      />
    </div>
  );
}

function CourierIdentityHeader({
  fullName,
  avatarUrl,
  isVerified,
  rating,
  deliveries,
  uploading,
  fileInputRef,
  onAvatarClick,
  onFileChange,
}: {
  fullName: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  rating: number;
  deliveries: number;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onAvatarClick: () => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="bg-white px-4 pt-8 pb-5">
      <div className="flex flex-col items-center">
        <div
          className="relative w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center overflow-hidden cursor-pointer group ring-4 ring-slate-50"
          onClick={onAvatarClick}
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt={fullName} className="w-full h-full object-cover" />
          ) : (
            <User className="w-9 h-9 text-slate-400" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
            {uploading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Camera className="w-5 h-5 text-white" />
            )}
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={onFileChange}
          disabled={uploading}
          className="hidden"
        />

        <h1 className="mt-3 text-lg font-bold text-gray-900 tracking-tight">{fullName}</h1>

        {isVerified && (
          <span className="mt-1 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
            <CheckCircle className="w-3 h-3" />
            Verified Courier
          </span>
        )}

        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="font-semibold text-gray-900">{rating > 0 ? rating.toFixed(1) : '--'}</span>
            <span className="text-gray-400">Rating</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1.5 text-sm text-gray-600">
            <Package className="w-4 h-4 text-moveme-blue-500" />
            <span className="font-semibold text-gray-900">{deliveries}</span>
            <span className="text-gray-400">Deliveries</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WalletCard({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="px-4 mt-4">
      <div
        className="bg-moveme-blue-900 rounded-2xl p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform"
        onClick={() => onNavigate('/wallet')}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-white/60 font-medium">Available Payout</p>
            <p className="text-xl font-bold text-white tracking-tight">$0.00 TTD</p>
          </div>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate('/wallet');
          }}
          className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-xl transition-colors active:scale-95"
        >
          Cash Out
        </button>
      </div>
    </div>
  );
}

function BackhaulCard({
  homeBase,
  onSetHomeBase,
}: {
  homeBase?: string | null;
  onSetHomeBase: () => void;
}) {
  return (
    <div className="px-4 mt-3">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-moveme-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Home className="w-4.5 h-4.5 text-moveme-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-gray-900">Backhaul Matching</p>
              <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded">NEW</span>
            </div>
            {homeBase ? (
              <div className="flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                <p className="text-xs text-gray-500 truncate">{homeBase}</p>
              </div>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Set your base to find return trips</p>
            )}
          </div>
          <button
            onClick={onSetHomeBase}
            className="px-3 py-1.5 bg-moveme-blue-50 text-moveme-blue-700 text-xs font-semibold rounded-lg hover:bg-moveme-blue-100 transition-colors flex-shrink-0"
          >
            {homeBase ? 'Update' : 'Set Up'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MenuItemData {
  icon: any;
  label: string;
  action?: () => void;
  path?: string;
  destructive?: boolean;
}

interface MenuGroup {
  title: string;
  items: MenuItemData[];
}

function CourierMenuGroups({
  onNavigate,
  onLogout,
  onShowTerms,
  isCompanyDriver,
}: {
  onNavigate: (path: string) => void;
  onLogout: () => void;
  onShowTerms: () => void;
  isCompanyDriver: boolean;
}) {
  const groups: MenuGroup[] = [
    {
      title: 'Operations',
      items: [
        { icon: Truck, label: 'My Garage (Vehicles)', path: '/more' },
        { icon: MapPin, label: 'Service Areas', path: '/more' },
      ],
    },
    {
      title: 'Account',
      items: [
        ...(!isCompanyDriver
          ? [{ icon: CreditCard, label: 'Payout Methods', path: '/payment-methods' }]
          : []),
        { icon: UserCircle, label: 'Personal Information', path: '/profile/edit' },
      ],
    },
    {
      title: 'Trust & Safety',
      items: [
        { icon: FileText, label: 'Document Center', path: '/more' },
        { icon: FileText, label: 'Terms of Service', action: onShowTerms },
      ],
    },
    {
      title: '',
      items: [
        { icon: LifeBuoy, label: 'Support & Help', path: '/support/chat' },
        { icon: LogOut, label: 'Log Out', action: onLogout, destructive: true },
      ],
    },
  ];

  const handleClick = (item: MenuItemData) => {
    if (item.action) item.action();
    else if (item.path) onNavigate(item.path);
  };

  return (
    <div className="px-4 mt-4 space-y-4">
      {groups.map((group, gi) => (
        <div key={gi}>
          {group.title && (
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">
              {group.title}
            </p>
          )}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {group.items.map((item, ii) => {
              const Icon = item.icon;
              const isLast = ii === group.items.length - 1;
              return (
                <button
                  key={ii}
                  onClick={() => handleClick(item)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 transition-colors text-left ${
                    !isLast ? 'border-b border-gray-50' : ''
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    item.destructive ? 'bg-red-50' : 'bg-slate-50'
                  }`}>
                    <Icon className={`w-4 h-4 ${item.destructive ? 'text-red-500' : 'text-gray-500'}`} />
                  </div>
                  <span className={`flex-1 text-sm font-medium ${
                    item.destructive ? 'text-red-600' : 'text-gray-900'
                  }`}>
                    {item.label}
                  </span>
                  {!item.destructive && (
                    <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function HaulageProfileLayout({
  profile,
  onNavigate,
  signOut,
}: {
  profile: any;
  onNavigate: (path: string) => void;
  signOut: () => void;
}) {
  const isVerified = profile.business_verification_status === 'approved';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="gradient-header px-4 py-8 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <div
              className="relative rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0 overflow-hidden backdrop-blur-sm border border-white/20"
              style={{ width: '72px', height: '72px' }}
            >
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                <User className="w-8 h-8 text-white/90" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold mb-0.5 tracking-tight text-white">
                {profile.company_name || profile.full_name}
              </h1>
              <p className="text-white/60 text-sm mb-2.5">
                {profile.company_email || profile.email}
              </p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-lg font-medium border border-white/10 text-white">
                  Haulage Account
                </span>
                {isVerified && (
                  <span className="flex items-center gap-1 text-xs text-success-300 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Verified
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <HaulageCompanyProfile />
        <HaulagePerformanceAnalytics />
        <HaulageFleetOverview />
        <HaulageDriverRoster />
        <HaulageVehicleRoster />
      </div>

      <div className="px-4 pb-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-all text-left"
            >
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <LogOut className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-red-600">Logout</p>
                <p className="text-sm text-gray-500 mt-0.5">Sign out of your account</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
