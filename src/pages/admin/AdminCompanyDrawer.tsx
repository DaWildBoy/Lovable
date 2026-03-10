import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { logAuditAction } from './adminUtils';
import {
  X, Star, Truck, Users, Calendar, Mail, Phone, MapPin,
  Shield, Package, CheckCircle, XCircle, Loader2, Building2,
  FileText, Clock, ShieldCheck, MapPinned, CreditCard,
  DollarSign, AlertTriangle, Receipt, Banknote, CalendarClock,
  Wrench, PhoneCall, Globe, PlayCircle, PauseCircle, Eye, ChevronDown, ChevronUp,
} from 'lucide-react';

interface Company {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  company_email: string | null;
  company_address: string | null;
  business_type: string | null;
  business_verification_status: string | null;
  business_verified: boolean | null;
  business_verified_at: string | null;
  created_at: string | null;
  haulage_business_registration: string | null;
  haulage_years_in_operation: number | null;
  haulage_insurance_status: string | null;
  haulage_operating_regions: string[] | null;
  haulage_cargo_specialties: string[] | null;
  haulage_equipment_types: string[] | null;
  haulage_service_hours: string | null;
  haulage_emergency_contact: string | null;
  haulage_dispatch_phone: string | null;
  haulage_tax_id: string | null;
  haulage_safety_rating: string | null;
  haulage_onboarding_completed: boolean | null;
  rating_average: number | null;
  completed_deliveries_count: number | null;
  driver_count?: number;
  vehicle_count?: number;
}

interface Subscription {
  id: string;
  plan_type: string;
  status: string;
  trial_start_date: string | null;
  trial_end_date: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  monthly_amount_ttd: number;
  billing_bank_name: string | null;
  billing_bank_account_number: string | null;
  last_payment_date: string | null;
  last_payment_amount_ttd: number | null;
  next_billing_date: string | null;
  created_at: string | null;
}

interface Payment {
  id: string;
  amount_ttd: number;
  payment_method: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  confirmed_at: string | null;
  created_at: string | null;
}

const TYPE_COLORS: Record<string, string> = {
  haulage: 'bg-moveme-blue-50 text-moveme-blue-700',
  retail: 'bg-warning-50 text-warning-700',
};
const STATUS_COLORS: Record<string, string> = {
  approved: 'bg-success-50 text-success-700',
  pending: 'bg-warning-50 text-warning-700',
  rejected: 'bg-error-50 text-error-700',
};
const SUB_STATUS_COLORS: Record<string, string> = {
  trial: 'bg-teal-50 text-teal-700',
  active: 'bg-success-50 text-success-700',
  past_due: 'bg-warning-50 text-warning-700',
  suspended: 'bg-error-50 text-error-700',
  cancelled: 'bg-gray-100 text-gray-600',
};
const PAYMENT_STATUS_COLORS: Record<string, string> = {
  confirmed: 'bg-success-50 text-success-700',
  pending: 'bg-warning-50 text-warning-700',
  failed: 'bg-error-50 text-error-700',
};

function formatDate(dateStr: string | null) {
  if (!dateStr) return '--';
  return new Date(dateStr).toLocaleDateString('en-TT', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCurrency(amount: number | null) {
  if (amount == null) return '--';
  return `TT$${amount.toLocaleString('en-TT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

interface Props {
  company: Company;
  onClose: () => void;
  onVerify: (id: string, action: 'approve' | 'reject') => void;
  onRefresh?: () => void;
}

interface DriverDoc {
  id: string;
  full_name: string;
  user_id: string | null;
  company_approved: boolean;
  license_front_url: string | null;
  license_back_url: string | null;
  license_upload_status: string | null;
  license_front_signed?: string;
  license_back_signed?: string;
}

export function AdminCompanyDrawer({ company, onClose, onVerify, onRefresh }: Props) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingSub, setLoadingSub] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [driverDocs, setDriverDocs] = useState<DriverDoc[]>([]);
  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [showDriverDocs, setShowDriverDocs] = useState(false);
  const [viewingDoc, setViewingDoc] = useState<{ name: string; front: string | null; back: string | null } | null>(null);

  const status = company.business_verification_status || 'pending';
  const isHaulage = company.business_type === 'haulage';

  const fetchSubscriptionData = async () => {
    setLoadingSub(true);
    try {
      const { data: subData } = await supabase
        .from('business_subscriptions')
        .select('id, plan_type, status, trial_start_date, trial_end_date, current_period_start, current_period_end, monthly_amount_ttd, billing_bank_name, billing_bank_account_number, last_payment_date, last_payment_amount_ttd, next_billing_date, created_at')
        .eq('business_user_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (subData) {
        setSubscription(subData as Subscription);
        const { data: payData } = await supabase
          .from('subscription_payments')
          .select('id, amount_ttd, payment_method, status, period_start, period_end, confirmed_at, created_at')
          .eq('business_user_id', company.id)
          .order('created_at', { ascending: false })
          .limit(10);
        setPayments((payData || []) as Payment[]);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
    } finally {
      setLoadingSub(false);
    }
  };

  const fetchDriverDocuments = async () => {
    if (!isHaulage) return;
    setLoadingDrivers(true);
    try {
      const { data } = await supabase
        .from('haulage_drivers')
        .select('id, full_name, user_id, company_approved, license_front_url, license_back_url, license_upload_status')
        .eq('company_id', company.id)
        .not('user_id', 'is', null)
        .order('full_name');

      const docs: DriverDoc[] = [];
      for (const d of data || []) {
        let frontSigned: string | undefined;
        let backSigned: string | undefined;
        if (d.license_front_url) {
          const { data: s } = await supabase.storage.from('driver-id-documents').createSignedUrl(d.license_front_url, 3600);
          frontSigned = s?.signedUrl || undefined;
        }
        if (d.license_back_url) {
          const { data: s } = await supabase.storage.from('driver-id-documents').createSignedUrl(d.license_back_url, 3600);
          backSigned = s?.signedUrl || undefined;
        }
        docs.push({ ...d, license_front_signed: frontSigned, license_back_signed: backSigned });
      }
      setDriverDocs(docs);
    } catch (err) {
      console.error('Error fetching driver documents:', err);
    } finally {
      setLoadingDrivers(false);
    }
  };

  useEffect(() => {
    fetchSubscriptionData();
    if (isHaulage) fetchDriverDocuments();
  }, [company.id]);

  const handleConfirmPayment = async (paymentId: string) => {
    setActionLoading(`confirm-${paymentId}`);
    try {
      const { error } = await supabase
        .from('subscription_payments')
        .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
        .eq('id', paymentId);
      if (error) throw error;

      if (subscription) {
        await supabase
          .from('business_subscriptions')
          .update({
            status: 'active',
            last_payment_date: new Date().toISOString(),
          })
          .eq('id', subscription.id);
      }

      await logAuditAction('confirm_payment', 'subscription', paymentId, {
        company: company.company_name || company.full_name || '',
        company_id: company.id,
      });
      await fetchSubscriptionData();
      onRefresh?.();
    } catch (err) {
      console.error('Error confirming payment:', err);
    } finally { setActionLoading(null); }
  };

  const handleSuspendSubscription = async () => {
    if (!subscription) return;
    setActionLoading('suspend');
    try {
      const { error } = await supabase
        .from('business_subscriptions')
        .update({ status: 'suspended' })
        .eq('id', subscription.id);
      if (error) throw error;

      await logAuditAction('suspend_subscription', 'subscription', subscription.id, {
        company: company.company_name || company.full_name || '',
        company_id: company.id,
      });
      await fetchSubscriptionData();
      onRefresh?.();
    } catch (err) {
      console.error('Error suspending subscription:', err);
    } finally { setActionLoading(null); }
  };

  const handleReactivateSubscription = async () => {
    if (!subscription) return;
    setActionLoading('reactivate');
    try {
      const { error } = await supabase
        .from('business_subscriptions')
        .update({ status: 'active' })
        .eq('id', subscription.id);
      if (error) throw error;

      await logAuditAction('reactivate_subscription', 'subscription', subscription.id, {
        company: company.company_name || company.full_name || '',
        company_id: company.id,
      });
      await fetchSubscriptionData();
      onRefresh?.();
    } catch (err) {
      console.error('Error reactivating subscription:', err);
    } finally { setActionLoading(null); }
  };

  const trialDaysLeft = subscription ? daysUntil(subscription.trial_end_date) : null;
  const periodDaysLeft = subscription ? daysUntil(subscription.current_period_end) : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white shadow-elevated animate-slide-up sm:animate-fade-in overflow-y-auto">
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold text-gray-900">Company Details</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isHaulage ? 'bg-moveme-blue-100' : 'bg-warning-100'}`}>
              {isHaulage ? <Truck className="w-7 h-7 text-moveme-blue-700" /> : <Building2 className="w-7 h-7 text-warning-700" />}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-gray-900 truncate">{company.company_name || company.full_name || 'Unnamed'}</h3>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[company.business_type || ''] || 'bg-gray-100 text-gray-600'}`}>
                  {(company.business_type || 'unknown').charAt(0).toUpperCase() + (company.business_type || 'unknown').slice(1)}
                </span>
                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[status] || STATUS_COLORS.pending}`}>
                  {status === 'approved' && <Shield className="w-3 h-3" />}
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
                {company.haulage_onboarding_completed && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-700">
                    <CheckCircle className="w-3 h-3" />Onboarded
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm"><Mail className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="text-gray-700 truncate">{company.company_email || company.email || '--'}</span></div>
            <div className="flex items-center gap-3 text-sm"><Phone className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="text-gray-700">{company.phone || '--'}</span></div>
            <div className="flex items-center gap-3 text-sm"><MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="text-gray-700">{company.company_address || '--'}</span></div>
            <div className="flex items-center gap-3 text-sm"><Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" /><span className="text-gray-700">Joined {formatDate(company.created_at)}</span></div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={Star} iconColor="text-warning-500" label="Rating" value={company.rating_average != null ? Number(company.rating_average).toFixed(1) : '--'} />
            <StatCard icon={Package} iconColor="text-gray-400" label="Deliveries" value={String(company.completed_deliveries_count ?? '--')} />
            {isHaulage && (
              <>
                <StatCard icon={Users} iconColor="text-gray-400" label="Drivers" value={String(company.driver_count ?? '--')} />
                <StatCard icon={Truck} iconColor="text-gray-400" label="Vehicles" value={String(company.vehicle_count ?? '--')} />
              </>
            )}
          </div>

          {loadingSub ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 text-moveme-blue-600 animate-spin" />
            </div>
          ) : subscription ? (
            <SubscriptionSection
              subscription={subscription}
              payments={payments}
              trialDaysLeft={trialDaysLeft}
              periodDaysLeft={periodDaysLeft}
              actionLoading={actionLoading}
              onConfirmPayment={handleConfirmPayment}
              onSuspend={handleSuspendSubscription}
              onReactivate={handleReactivateSubscription}
            />
          ) : (
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <CreditCard className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No subscription found</p>
            </div>
          )}

          {isHaulage && <RegistrationSection company={company} />}

          {isHaulage && company.haulage_operating_regions && company.haulage_operating_regions.length > 0 && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5">
                <MapPinned className="w-3.5 h-3.5 text-gray-400" />
                <p className="text-xs font-semibold text-gray-500 uppercase">Operating Regions</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {company.haulage_operating_regions.map((r) => (
                  <span key={r} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-moveme-blue-50 text-moveme-blue-700">{r}</span>
                ))}
              </div>
            </div>
          )}

          {isHaulage && <OperationsSection company={company} />}

          {isHaulage && (
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowDriverDocs(!showDriverDocs)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-500" />
                  <p className="text-xs font-semibold text-gray-500 uppercase">Driver License Documents</p>
                  <span className="text-xs text-gray-400">({driverDocs.length})</span>
                </div>
                {showDriverDocs ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </button>
              {showDriverDocs && (
                <div className="px-4 pb-4 space-y-2">
                  {loadingDrivers ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
                    </div>
                  ) : driverDocs.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">No drivers linked yet</p>
                  ) : (
                    driverDocs.map((d) => {
                      const hasLicense = d.license_front_signed || d.license_back_signed;
                      return (
                        <div key={d.id} className="bg-white rounded-lg border border-gray-200 p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-bold text-gray-600">{d.full_name.charAt(0).toUpperCase()}</span>
                              </div>
                              <span className="text-sm font-medium text-gray-900">{d.full_name}</span>
                            </div>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${d.company_approved ? 'bg-success-50 text-success-700' : 'bg-warning-50 text-warning-700'}`}>
                              {d.company_approved ? 'Approved' : 'Pending'}
                            </span>
                          </div>
                          {hasLicense ? (
                            <div className="flex items-center gap-2">
                              {d.license_front_signed && (
                                <div className="relative w-16 h-11 rounded overflow-hidden border border-gray-200">
                                  <img src={d.license_front_signed} alt="Front" className="w-full h-full object-cover" />
                                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center font-medium">Front</span>
                                </div>
                              )}
                              {d.license_back_signed && (
                                <div className="relative w-16 h-11 rounded overflow-hidden border border-gray-200">
                                  <img src={d.license_back_signed} alt="Back" className="w-full h-full object-cover" />
                                  <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] text-center font-medium">Back</span>
                                </div>
                              )}
                              <button
                                onClick={() => setViewingDoc({
                                  name: d.full_name,
                                  front: d.license_front_signed || null,
                                  back: d.license_back_signed || null,
                                })}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors font-medium"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                              <XCircle className="w-3 h-3" />
                              <span>No license uploaded</span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          )}

          {viewingDoc && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setViewingDoc(null)}>
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">Driver's License</h3>
                    <p className="text-xs text-gray-500">{viewingDoc.name}</p>
                  </div>
                  <button onClick={() => setViewingDoc(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-5 space-y-4">
                  {viewingDoc.front && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Front</p>
                      <img src={viewingDoc.front} alt="License front" className="w-full rounded-xl border border-gray-200 shadow-sm" />
                    </div>
                  )}
                  {viewingDoc.back && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Back</p>
                      <img src={viewingDoc.back} alt="License back" className="w-full rounded-xl border border-gray-200 shadow-sm" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="pt-2 space-y-2">
            {status !== 'approved' && (
              <button onClick={() => onVerify(company.id, 'approve')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-success-600 text-white rounded-xl text-sm font-medium hover:bg-success-700 transition-colors">
                <CheckCircle className="w-4 h-4" />Approve Company
              </button>
            )}
            {status !== 'rejected' && (
              <button onClick={() => onVerify(company.id, 'reject')} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-error-600 text-white rounded-xl text-sm font-medium hover:bg-error-700 transition-colors">
                <XCircle className="w-4 h-4" />Reject Company
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, iconColor, label, value }: { icon: typeof Star; iconColor: string; label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3.5">
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
        <p className="text-xs text-gray-400 font-medium">{label}</p>
      </div>
      <p className="text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}

function SubscriptionSection({ subscription, payments, trialDaysLeft, periodDaysLeft, actionLoading, onConfirmPayment, onSuspend, onReactivate }: {
  subscription: Subscription;
  payments: Payment[];
  trialDaysLeft: number | null;
  periodDaysLeft: number | null;
  actionLoading: string | null;
  onConfirmPayment: (paymentId: string) => void;
  onSuspend: () => void;
  onReactivate: () => void;
}) {
  const sub = subscription;
  const isOverdue = sub.status === 'past_due';
  const isSuspended = sub.status === 'suspended';
  const canSuspend = sub.status === 'active' || sub.status === 'past_due' || sub.status === 'trial';
  const canReactivate = sub.status === 'suspended';

  return (
    <div className="space-y-3">
      <div className={`rounded-xl border p-4 space-y-3 ${isOverdue ? 'border-warning-200 bg-warning-50/30' : isSuspended ? 'border-error-200 bg-error-50/30' : 'border-gray-100 bg-white'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-500" />
            <p className="text-sm font-semibold text-gray-900">Subscription</p>
          </div>
          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${SUB_STATUS_COLORS[sub.status] || 'bg-gray-100 text-gray-600'}`}>
            {sub.status === 'past_due' && <AlertTriangle className="w-3 h-3" />}
            {sub.status === 'active' && <CheckCircle className="w-3 h-3" />}
            {sub.status === 'trial' ? `Trial${trialDaysLeft != null ? ` (${Math.max(0, trialDaysLeft)}d left)` : ''}` :
             sub.status === 'past_due' ? 'Past Due' :
             sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
          <div>
            <p className="text-xs text-gray-400 font-medium mb-0.5">Plan</p>
            <p className="font-medium text-gray-900 capitalize">{sub.plan_type}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-0.5">Monthly</p>
            <p className="font-medium text-gray-900">{formatCurrency(sub.monthly_amount_ttd)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-0.5">Current Period</p>
            <p className="font-medium text-gray-900">
              {sub.current_period_start ? `${formatDate(sub.current_period_start)} - ${formatDate(sub.current_period_end)}` : '--'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-0.5">Next Billing</p>
            <p className={`font-medium ${periodDaysLeft != null && periodDaysLeft <= 3 ? 'text-warning-700' : 'text-gray-900'}`}>
              {formatDate(sub.next_billing_date)}
              {periodDaysLeft != null && periodDaysLeft <= 7 && periodDaysLeft >= 0 && (
                <span className="text-xs text-warning-600 ml-1">({periodDaysLeft}d)</span>
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-0.5">Last Payment</p>
            <p className="font-medium text-gray-900">{formatDate(sub.last_payment_date)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 font-medium mb-0.5">Last Amount</p>
            <p className="font-medium text-gray-900">{formatCurrency(sub.last_payment_amount_ttd)}</p>
          </div>
        </div>

        {sub.billing_bank_name && (
          <div className="pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-1.5">
              <Banknote className="w-3.5 h-3.5 text-gray-400" />
              <p className="text-xs font-semibold text-gray-500 uppercase">Billing Bank</p>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-700">{sub.billing_bank_name}</span>
              {sub.billing_bank_account_number && (
                <span className="text-gray-400 font-mono text-xs">****{sub.billing_bank_account_number.slice(-4)}</span>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
          {canSuspend && (
            <button
              onClick={onSuspend}
              disabled={actionLoading === 'suspend'}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-error-50 text-error-700 rounded-lg text-xs font-medium hover:bg-error-100 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'suspend' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PauseCircle className="w-3.5 h-3.5" />}
              Suspend
            </button>
          )}
          {canReactivate && (
            <button
              onClick={onReactivate}
              disabled={actionLoading === 'reactivate'}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-success-50 text-success-700 rounded-lg text-xs font-medium hover:bg-success-100 transition-colors disabled:opacity-50"
            >
              {actionLoading === 'reactivate' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
              Reactivate
            </button>
          )}
        </div>

        <div className="text-xs text-gray-400">
          Subscribed {formatDate(sub.created_at)}
        </div>
      </div>

      {payments.length > 0 && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-semibold text-gray-500 uppercase">Payment History</p>
            <span className="text-xs text-gray-400 ml-auto">{payments.length} record{payments.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center gap-3 bg-white rounded-lg p-2.5">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${p.status === 'confirmed' ? 'bg-success-50' : 'bg-warning-50'}`}>
                  <DollarSign className={`w-3.5 h-3.5 ${p.status === 'confirmed' ? 'text-success-600' : 'text-warning-600'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(p.amount_ttd)}</p>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${PAYMENT_STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-600'}`}>
                        {p.status.charAt(0).toUpperCase() + p.status.slice(1)}
                      </span>
                      {p.status === 'pending' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onConfirmPayment(p.id); }}
                          disabled={actionLoading === `confirm-${p.id}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-success-600 text-white rounded-full text-[10px] font-medium hover:bg-success-700 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === `confirm-${p.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                          Confirm
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                    <span className="capitalize">{p.payment_method.replace('_', ' ')}</span>
                    <span>{formatDate(p.confirmed_at || p.created_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RegistrationSection({ company }: { company: Company }) {
  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase">Registration Details</p>
      <div className="text-sm text-gray-700 space-y-1.5">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span>Reg: <span className="font-medium text-gray-900">{company.haulage_business_registration || '--'}</span></span>
        </div>
        {company.haulage_tax_id && (
          <div className="flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>Tax ID: <span className="font-medium text-gray-900">{company.haulage_tax_id}</span></span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span>Years: <span className="font-medium text-gray-900">{company.haulage_years_in_operation ?? '--'}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <span>Insurance: <span className="font-medium text-gray-900 capitalize">{company.haulage_insurance_status || '--'}</span></span>
        </div>
        {company.haulage_safety_rating && (
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>Safety Rating: <span className="font-medium text-gray-900">{company.haulage_safety_rating}</span></span>
          </div>
        )}
      </div>
    </div>
  );
}

function OperationsSection({ company }: { company: Company }) {
  const hasCargoSpecialties = company.haulage_cargo_specialties && company.haulage_cargo_specialties.length > 0;
  const hasEquipment = company.haulage_equipment_types && company.haulage_equipment_types.length > 0;
  const hasContacts = company.haulage_service_hours || company.haulage_dispatch_phone || company.haulage_emergency_contact;

  if (!hasCargoSpecialties && !hasEquipment && !hasContacts) return null;

  return (
    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-gray-500 uppercase">Operations</p>

      {hasContacts && (
        <div className="text-sm text-gray-700 space-y-1.5">
          {company.haulage_service_hours && (
            <div className="flex items-center gap-2">
              <CalendarClock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>Hours: <span className="font-medium text-gray-900">{company.haulage_service_hours}</span></span>
            </div>
          )}
          {company.haulage_dispatch_phone && (
            <div className="flex items-center gap-2">
              <PhoneCall className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>Dispatch: <span className="font-medium text-gray-900">{company.haulage_dispatch_phone}</span></span>
            </div>
          )}
          {company.haulage_emergency_contact && (
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              <span>Emergency: <span className="font-medium text-gray-900">{company.haulage_emergency_contact}</span></span>
            </div>
          )}
        </div>
      )}

      {hasCargoSpecialties && (
        <div>
          <p className="text-xs text-gray-400 font-medium mb-1.5">Cargo Specialties</p>
          <div className="flex flex-wrap gap-1.5">
            {company.haulage_cargo_specialties!.map((s) => (
              <span key={s} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-success-50 text-success-700">{s}</span>
            ))}
          </div>
        </div>
      )}

      {hasEquipment && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Wrench className="w-3 h-3 text-gray-400" />
            <p className="text-xs text-gray-400 font-medium">Equipment Types</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {company.haulage_equipment_types!.map((e) => (
              <span key={e} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-warning-50 text-warning-700">{e}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
