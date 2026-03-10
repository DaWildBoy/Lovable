import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  X, Mail, Phone, Calendar, Star, Package, KeyRound, Loader2,
  Shield, ShieldCheck, ShieldX, Car, Landmark, CreditCard, MapPin,
  Building2, FileText, Truck, Users as UsersIcon, Clock, AlertTriangle,
  CheckCircle2, XCircle, Ban, ChevronRight, Globe, Wrench, DollarSign,
  UserCheck, CircleDot, ChevronDown,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin, getAdminRoleLabel } from '../../lib/adminAuth';
import type {
  AdminProfile, CourierRecord, HaulageDriver, HaulageVehicle,
  BusinessSubscription, ROLE_COLORS, VERIFICATION_COLORS,
} from './AdminUserTypes';

interface UserDrawerProps {
  user: AdminProfile;
  onClose: () => void;
  onUserUpdated: () => void;
}

function ResetPasswordModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleReset = async () => {
    if (pw.length < 6) { setResult({ ok: false, msg: 'Password must be at least 6 characters' }); return; }
    setLoading(true); setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ userId, newPassword: pw }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || 'Request failed'); }
      setResult({ ok: true, msg: 'Password updated successfully' }); setPw('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to reset password';
      setResult({ ok: false, msg: message });
    } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-sm mx-4 p-6 animate-scale-in">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Reset Password</h3>
        <input
          type="password"
          placeholder="New password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none mb-3"
        />
        {result && (
          <p className={`text-xs mb-3 ${result.ok ? 'text-success-600' : 'text-error-600'}`}>{result.msg}</p>
        )}
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleReset}
            disabled={loading || !pw}
            className="flex-1 px-4 py-2.5 bg-moveme-blue-600 text-white rounded-xl text-sm font-medium hover:bg-moveme-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ title, message, confirmLabel, variant, loading: externalLoading, onConfirm, onClose }: {
  title: string; message: string; confirmLabel: string; variant: 'danger' | 'success';
  loading?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-sm mx-4 p-6 animate-scale-in">
        <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-5">{message}</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={externalLoading}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors flex items-center justify-center gap-2 ${
              variant === 'danger' ? 'bg-error-600 hover:bg-error-700' : 'bg-success-600 hover:bg-success-700'
            } disabled:opacity-50`}
          >
            {externalLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: typeof Mail; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center">
        <Icon className="w-3.5 h-3.5 text-gray-500" />
      </div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{title}</h4>
    </div>
  );
}

function InfoRow({ label, value, mono }: { label: string; value: string | null | undefined; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-xs text-gray-400 font-medium">{label}</span>
      <span className={`text-sm text-gray-900 text-right max-w-[60%] break-words ${mono ? 'font-mono text-xs' : ''}`}>
        {value || '--'}
      </span>
    </div>
  );
}

function StatusBadge({ status, map }: { status: string | null; map: Record<string, string> }) {
  const s = status || 'pending';
  const colors = map[s] || map['pending'] || 'bg-gray-100 text-gray-500';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      {s === 'approved' || s === 'verified' ? <CheckCircle2 className="w-3 h-3" /> :
       s === 'rejected' ? <XCircle className="w-3 h-3" /> :
       <Clock className="w-3 h-3" />}
      {s.charAt(0).toUpperCase() + s.slice(1)}
    </span>
  );
}

const VERIF_COLORS: Record<string, string> = {
  approved: 'bg-success-50 text-success-700',
  verified: 'bg-success-50 text-success-700',
  rejected: 'bg-error-50 text-error-700',
  pending: 'bg-warning-50 text-warning-700',
  unverified: 'bg-gray-100 text-gray-500',
};

const ROLE_CLR: Record<string, string> = {
  customer: 'bg-moveme-blue-50 text-moveme-blue-700',
  courier: 'bg-moveme-teal-50 text-moveme-teal-700',
  business: 'bg-warning-50 text-warning-700',
  admin: 'bg-gray-100 text-gray-700',
  verification_admin: 'bg-amber-50 text-amber-700',
  support_admin: 'bg-sky-50 text-sky-700',
  super_admin: 'bg-error-50 text-error-700',
};

const ALL_ROLES = [
  { value: 'customer', label: 'Customer' },
  { value: 'courier', label: 'Courier' },
  { value: 'business', label: 'Business' },
  { value: 'verification_admin', label: 'Verification Admin' },
  { value: 'support_admin', label: 'Support Admin' },
  { value: 'super_admin', label: 'Super Admin' },
];

const ROLE_LABEL_MAP: Record<string, string> = {
  super_admin: 'Super Admin',
  support_admin: 'Support Admin',
  verification_admin: 'Verification Admin',
};

export function AdminUserDrawer({ user, onClose, onUserUpdated }: UserDrawerProps) {
  const { profile: currentAdmin } = useAuth();
  const canChangeRole = isSuperAdmin(currentAdmin) && user.id !== currentAdmin?.id;

  const [activeSection, setActiveSection] = useState<'overview' | 'financial' | 'vehicle' | 'business' | 'fleet'>('overview');
  const [courier, setCourier] = useState<CourierRecord | null>(null);
  const [drivers, setDrivers] = useState<HaulageDriver[]>([]);
  const [vehicles, setVehicles] = useState<HaulageVehicle[]>([]);
  const [subscription, setSubscription] = useState<BusinessSubscription | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [showResetPw, setShowResetPw] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | 'verify' | 'reject' | 'suspend'>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [roleLoading, setRoleLoading] = useState(false);

  const displayName = user.full_name || [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Unnamed';
  const isCourier = user.role === 'courier';
  const isBusiness = user.role === 'business';
  const isHaulage = isBusiness && user.business_type === 'haulage';
  const isRetail = isBusiness && user.business_type === 'retail';

  useEffect(() => {
    const loadExtra = async () => {
      setLoadingExtra(true);
      const promises: Promise<void>[] = [];

      if (isCourier) {
        promises.push(
          supabase.from('couriers').select('*').eq('user_id', user.id).maybeSingle()
            .then(({ data }) => { if (data) setCourier(data as CourierRecord); })
        );
      }

      if (isBusiness) {
        promises.push(
          supabase.from('business_subscriptions').select('*').eq('business_user_id', user.id)
            .order('created_at', { ascending: false }).limit(1).maybeSingle()
            .then(({ data }) => { if (data) setSubscription(data as BusinessSubscription); })
        );
      }

      if (isHaulage) {
        promises.push(
          supabase.from('haulage_drivers').select('*').eq('company_id', user.id)
            .then(({ data }) => { if (data) setDrivers(data as HaulageDriver[]); }),
          supabase.from('haulage_vehicles').select('*').eq('company_id', user.id)
            .then(({ data }) => { if (data) setVehicles(data as HaulageVehicle[]); })
        );
      }

      await Promise.all(promises);
      setLoadingExtra(false);
    };
    loadExtra();
  }, [user.id, isCourier, isBusiness, isHaulage]);

  const handleVerify = async () => {
    setActionLoading(true);
    try {
      if (isCourier && courier) {
        await supabase.from('couriers').update({ verified: true, verification_status: 'approved' }).eq('id', courier.id);
      }
      if (isBusiness) {
        await supabase.from('profiles').update({
          business_verification_status: 'approved',
          business_verified: true,
          business_verified_at: new Date().toISOString(),
        }).eq('id', user.id);
      }
      onUserUpdated();
    } finally { setActionLoading(false); setConfirmAction(null); }
  };

  const handleReject = async () => {
    setActionLoading(true);
    try {
      if (isCourier && courier) {
        await supabase.from('couriers').update({ verified: false, verification_status: 'rejected' }).eq('id', courier.id);
      }
      if (isBusiness) {
        await supabase.from('profiles').update({
          business_verification_status: 'rejected',
          business_verified: false,
        }).eq('id', user.id);
      }
      onUserUpdated();
    } finally { setActionLoading(false); setConfirmAction(null); }
  };

  const handleVerifyCourierBank = async () => {
    setActionLoading(true);
    try {
      await supabase.from('profiles').update({
        courier_bank_verified: true,
        courier_bank_verified_at: new Date().toISOString(),
      }).eq('id', user.id);
      onUserUpdated();
    } finally { setActionLoading(false); }
  };

  const sections = [
    { key: 'overview' as const, label: 'Overview' },
    ...(isCourier ? [{ key: 'financial' as const, label: 'Bank & Pay' }, { key: 'vehicle' as const, label: 'Vehicle' }] : []),
    ...(isBusiness ? [{ key: 'business' as const, label: 'Business' }] : []),
    ...(isHaulage ? [{ key: 'fleet' as const, label: 'Fleet' }] : []),
    ...(!isCourier && !isBusiness ? [{ key: 'financial' as const, label: 'Payment' }] : []),
  ];

  const verificationStatus = isCourier
    ? (courier?.verification_status || 'pending')
    : isBusiness
    ? (user.business_verification_status || 'pending')
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-elevated animate-slide-up sm:animate-fade-in flex flex-col h-full">
        <div className="sticky top-0 bg-white border-b border-gray-100 z-10 flex-shrink-0">
          <div className="px-5 py-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">User Details</h2>
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-5 pb-3 flex gap-1 overflow-x-auto scrollbar-hide">
            {sections.map((s) => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeSection === s.key
                    ? 'bg-moveme-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-5">
            <div className="flex items-start gap-4">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-moveme-blue-100 flex items-center justify-center text-moveme-blue-700 text-xl font-bold flex-shrink-0">
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 truncate">{displayName}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {canChangeRole ? (
                    <div className="relative">
                      <button
                        onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                        disabled={roleLoading}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_CLR[user.role || 'customer']} hover:opacity-80 transition-all`}
                      >
                        {roleLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                        {ROLE_LABEL_MAP[user.role || ''] || (user.role || 'customer').charAt(0).toUpperCase() + (user.role || 'customer').slice(1)}
                        <ChevronDown className={`w-3 h-3 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
                      </button>
                      {roleDropdownOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setRoleDropdownOpen(false)} />
                          <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-elevated border border-gray-200 py-1 z-40">
                            {ALL_ROLES.map((r) => (
                              <button
                                key={r.value}
                                onClick={async () => {
                                  if (r.value === user.role) { setRoleDropdownOpen(false); return; }
                                  setRoleLoading(true);
                                  setRoleDropdownOpen(false);
                                  try {
                                    await supabase.from('profiles').update({ role: r.value }).eq('id', user.id);
                                    onUserUpdated();
                                  } finally { setRoleLoading(false); }
                                }}
                                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${
                                  r.value === user.role ? 'font-medium bg-gray-50' : ''
                                }`}
                              >
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_CLR[r.value] || 'bg-gray-100 text-gray-600'}`}>
                                  {r.label}
                                </span>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_CLR[user.role || 'customer']}`}>
                      {ROLE_LABEL_MAP[user.role || ''] || (user.role || 'customer').charAt(0).toUpperCase() + (user.role || 'customer').slice(1)}
                    </span>
                  )}
                  {verificationStatus && (
                    <StatusBadge status={verificationStatus} map={VERIF_COLORS} />
                  )}
                  {isBusiness && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                      {user.business_type || 'unknown'}
                    </span>
                  )}
                </div>
                {isCourier && courier?.is_online !== null && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <CircleDot className={`w-3 h-3 ${courier?.is_online ? 'text-success-500' : 'text-gray-300'}`} />
                    <span className="text-xs text-gray-500">{courier?.is_online ? 'Online now' : 'Offline'}</span>
                  </div>
                )}
              </div>
            </div>

            {activeSection === 'overview' && (
              <>
                <div className="bg-gray-50 rounded-xl p-4">
                  <SectionHeader icon={Mail} title="Contact Information" />
                  <InfoRow label="Email" value={user.email} />
                  <InfoRow label="Phone" value={user.phone} />
                  <InfoRow label="Joined" value={user.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : null} />
                  {user.home_base_location_text && (
                    <InfoRow label="Home Base" value={user.home_base_location_text} />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3.5 text-center">
                    <Star className="w-4 h-4 text-warning-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{user.rating_average != null ? user.rating_average.toFixed(1) : '--'}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Rating</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3.5 text-center">
                    <Package className="w-4 h-4 text-moveme-blue-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{user.completed_deliveries_count ?? '--'}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Deliveries</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3.5 text-center">
                    <UsersIcon className="w-4 h-4 text-moveme-teal-500 mx-auto mb-1" />
                    <p className="text-lg font-bold text-gray-900">{user.rating_count ?? '--'}</p>
                    <p className="text-[10px] text-gray-400 font-medium">Reviews</p>
                  </div>
                </div>

                {isCourier && courier && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <SectionHeader icon={DollarSign} title="Courier Earnings" />
                    <InfoRow label="Total Earnings" value={courier.total_earnings_ttd != null ? `$${courier.total_earnings_ttd.toFixed(2)} TTD` : null} />
                    <InfoRow label="Completed Jobs" value={courier.completed_deliveries_count?.toString()} />
                    <InfoRow label="Member Since" value={courier.created_at ? new Date(courier.created_at).toLocaleDateString() : null} />
                  </div>
                )}
              </>
            )}

            {activeSection === 'financial' && isCourier && (
              <>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <SectionHeader icon={Landmark} title="Bank Account" />
                    {user.courier_bank_verified ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-700">
                        <ShieldCheck className="w-3 h-3" /> Verified
                      </span>
                    ) : user.courier_bank_name ? (
                      <button
                        onClick={handleVerifyCourierBank}
                        disabled={actionLoading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-success-600 text-white hover:bg-success-700 transition-colors disabled:opacity-50"
                      >
                        {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                        Verify Bank
                      </button>
                    ) : null}
                  </div>
                  <InfoRow label="Bank Name" value={user.courier_bank_name} />
                  <InfoRow label="Account Name" value={user.courier_bank_account_name} />
                  <InfoRow label="Account Number" value={user.courier_bank_account_number} mono />
                  <InfoRow label="Routing Number" value={user.courier_bank_routing_number} mono />
                  <InfoRow label="Added" value={user.courier_bank_added_at ? new Date(user.courier_bank_added_at).toLocaleDateString() : null} />
                  {user.courier_bank_verified_at && (
                    <InfoRow label="Verified On" value={new Date(user.courier_bank_verified_at).toLocaleDateString()} />
                  )}
                </div>

                {courier && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <SectionHeader icon={DollarSign} title="Earnings Summary" />
                    <InfoRow label="Total Earnings" value={courier.total_earnings_ttd != null ? `$${courier.total_earnings_ttd.toFixed(2)} TTD` : null} />
                    <InfoRow label="Completed Deliveries" value={courier.completed_deliveries_count?.toString()} />
                  </div>
                )}
              </>
            )}

            {activeSection === 'financial' && !isCourier && !isBusiness && (
              <div className="bg-gray-50 rounded-xl p-4">
                <SectionHeader icon={CreditCard} title="Payment Method" />
                <InfoRow label="Method" value={user.customer_payment_method} />
                <InfoRow label="Card Last 4" value={user.customer_payment_last4 ? `**** ${user.customer_payment_last4}` : null} mono />
                <InfoRow label="Verified" value={user.customer_payment_verified ? 'Yes' : 'No'} />
              </div>
            )}

            {activeSection === 'vehicle' && isCourier && courier && (
              <div className="bg-gray-50 rounded-xl p-4">
                <SectionHeader icon={Car} title="Vehicle Information" />
                <InfoRow label="Type" value={courier.vehicle_type} />
                <InfoRow label="Make" value={courier.vehicle_make} />
                <InfoRow label="Model" value={courier.vehicle_model} />
                <InfoRow label="Year" value={courier.vehicle_year?.toString()} />
                <InfoRow label="Plate Number" value={courier.vehicle_plate} mono />
                <InfoRow label="Verification" value={courier.verification_status} />
              </div>
            )}

            {activeSection === 'business' && isBusiness && (
              <>
                <div className="bg-gray-50 rounded-xl p-4">
                  <SectionHeader icon={Building2} title="Company Details" />
                  <InfoRow label="Company Name" value={user.company_name} />
                  <InfoRow label="Business Type" value={user.business_type} />
                  <InfoRow label="Company Email" value={user.company_email} />
                  <InfoRow label="Company Address" value={user.company_address} />
                  <InfoRow label="Verification" value={user.business_verification_status} />
                  {user.business_verified_at && (
                    <InfoRow label="Verified On" value={new Date(user.business_verified_at).toLocaleDateString()} />
                  )}
                </div>

                {isHaulage && (
                  <>
                    <div className="bg-gray-50 rounded-xl p-4">
                      <SectionHeader icon={FileText} title="Haulage Licensing & Insurance" />
                      <InfoRow label="Business Registration" value={user.haulage_business_registration} />
                      <InfoRow label="Operating License" value={user.haulage_operating_license_number} mono />
                      <InfoRow label="License Expiry" value={user.haulage_operating_license_expiry ? new Date(user.haulage_operating_license_expiry).toLocaleDateString() : null} />
                      <InfoRow label="DOT Number" value={user.haulage_dot_number} mono />
                      <InfoRow label="Insurance Status" value={user.haulage_insurance_status} />
                      <InfoRow label="Insurance Expiry" value={user.haulage_insurance_expiry ? new Date(user.haulage_insurance_expiry).toLocaleDateString() : null} />
                      <InfoRow label="Insurance Amount" value={user.haulage_cargo_insurance_amount != null ? `$${user.haulage_cargo_insurance_amount.toLocaleString()} TTD` : null} />
                      {user.haulage_insurance_certificate_url && (
                        <div className="pt-2 border-t border-gray-100 mt-2">
                          <a
                            href={user.haulage_insurance_certificate_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-moveme-blue-600 hover:text-moveme-blue-700"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            View Insurance Certificate
                            <ChevronRight className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <SectionHeader icon={Globe} title="Operations" />
                      <InfoRow label="Years in Operation" value={user.haulage_years_in_operation?.toString()} />
                      <InfoRow label="Safety Rating" value={user.haulage_safety_rating} />
                      <InfoRow label="On-Time Rate" value={user.haulage_on_time_delivery_rate != null ? `${user.haulage_on_time_delivery_rate}%` : null} />
                      <InfoRow label="Service Hours" value={user.haulage_service_hours} />
                      <InfoRow label="Max Fleet Capacity" value={user.haulage_max_fleet_capacity_kg != null ? `${user.haulage_max_fleet_capacity_kg.toLocaleString()} kg` : null} />
                      <InfoRow label="Tax ID" value={user.haulage_tax_id} mono />
                      {user.haulage_operating_regions && user.haulage_operating_regions.length > 0 && (
                        <div className="pt-2 mt-1">
                          <span className="text-xs text-gray-400 font-medium">Regions</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.haulage_operating_regions.map((r) => (
                              <span key={r} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border border-gray-200">{r}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {user.haulage_cargo_specialties && user.haulage_cargo_specialties.length > 0 && (
                        <div className="pt-2 mt-1">
                          <span className="text-xs text-gray-400 font-medium">Cargo Specialties</span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {user.haulage_cargo_specialties.map((s) => (
                              <span key={s} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border border-gray-200">{s}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4">
                      <SectionHeader icon={Phone} title="Haulage Contacts" />
                      <InfoRow label="Dispatch Phone" value={user.haulage_dispatch_phone} />
                      <InfoRow label="Emergency Contact" value={user.haulage_emergency_contact} />
                      <InfoRow label="Billing Email" value={user.haulage_billing_email} />
                      <InfoRow label="Payment Terms" value={user.haulage_payment_terms} />
                    </div>
                  </>
                )}

                {subscription && (
                  <div className="bg-gray-50 rounded-xl p-4">
                    <SectionHeader icon={CreditCard} title="Subscription" />
                    <InfoRow label="Plan" value={subscription.plan_type} />
                    <InfoRow label="Status" value={subscription.status} />
                    <InfoRow label="Monthly Amount" value={`$${subscription.monthly_amount_ttd.toFixed(2)} TTD`} />
                    <InfoRow label="Period Ends" value={subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : null} />
                    <InfoRow label="Next Billing" value={subscription.next_billing_date ? new Date(subscription.next_billing_date).toLocaleDateString() : null} />
                    <InfoRow label="Last Payment" value={subscription.last_payment_date ? new Date(subscription.last_payment_date).toLocaleDateString() : null} />
                  </div>
                )}
              </>
            )}

            {activeSection === 'fleet' && isHaulage && (
              <>
                {loadingExtra ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-moveme-blue-600 animate-spin" />
                  </div>
                ) : (
                  <>
                    <div>
                      <SectionHeader icon={UsersIcon} title={`Drivers (${drivers.length})`} />
                      {drivers.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No drivers registered</p>
                      ) : (
                        <div className="space-y-2">
                          {drivers.map((d) => (
                            <div key={d.id} className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900">{d.full_name}</p>
                                <p className="text-xs text-gray-400">{d.phone || 'No phone'} {d.license_type ? `| ${d.license_type}` : ''}</p>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${d.is_active ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'}`}>
                                {d.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <SectionHeader icon={Truck} title={`Vehicles (${vehicles.length})`} />
                      {vehicles.length === 0 ? (
                        <p className="text-sm text-gray-400 italic">No vehicles registered</p>
                      ) : (
                        <div className="space-y-2">
                          {vehicles.map((v) => (
                            <div key={v.id} className="bg-gray-50 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-sm font-medium text-gray-900">{v.vehicle_name}</p>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.is_active ? 'bg-success-50 text-success-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {v.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-400">
                                <span>Type: {v.vehicle_type}</span>
                                {v.plate_number && <span>Plate: {v.plate_number}</span>}
                                {v.capacity_kg && <span>Cap: {v.capacity_kg.toLocaleString()} kg</span>}
                                {v.special_equipment && <span>Equip: {v.special_equipment}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 flex-shrink-0 space-y-2">
          {(isCourier || isBusiness) && verificationStatus !== 'approved' && verificationStatus !== 'verified' && (
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmAction('verify')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-success-600 text-white rounded-xl text-sm font-medium hover:bg-success-700 transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                Approve
              </button>
              <button
                onClick={() => setConfirmAction('reject')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-error-600 text-white rounded-xl text-sm font-medium hover:bg-error-700 transition-colors"
              >
                <ShieldX className="w-4 h-4" />
                Reject
              </button>
            </div>
          )}
          <button
            onClick={() => setShowResetPw(true)}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-moveme-blue-600 text-white rounded-xl text-sm font-medium hover:bg-moveme-blue-700 transition-colors"
          >
            <KeyRound className="w-4 h-4" />
            Reset Password
          </button>
        </div>
      </div>

      {showResetPw && <ResetPasswordModal userId={user.id} onClose={() => setShowResetPw(false)} />}

      {confirmAction === 'verify' && (
        <ConfirmModal
          title="Approve User"
          message={`Are you sure you want to approve ${displayName}? This will grant them full verified status.`}
          confirmLabel="Approve"
          variant="success"
          loading={actionLoading}
          onConfirm={handleVerify}
          onClose={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === 'reject' && (
        <ConfirmModal
          title="Reject User"
          message={`Are you sure you want to reject ${displayName}'s verification? They will need to resubmit their information.`}
          confirmLabel="Reject"
          variant="danger"
          loading={actionLoading}
          onConfirm={handleReject}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}
