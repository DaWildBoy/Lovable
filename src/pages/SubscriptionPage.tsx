import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  CreditCard,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Sparkles,
  Building2,
  Calendar,
  Receipt,
  Loader2,
  Shield,
  Edit3,
  Save,
  X,
} from 'lucide-react';

interface SubscriptionPageProps {
  onNavigate: (path: string) => void;
}

interface Subscription {
  id: string;
  status: string;
  plan_type: string;
  trial_start_date: string | null;
  trial_end_date: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  monthly_amount_ttd: number;
  billing_bank_name: string | null;
  billing_bank_account_name: string | null;
  billing_bank_account_number: string | null;
  billing_bank_routing_number: string | null;
  next_billing_date: string | null;
  last_payment_date: string | null;
  last_payment_amount_ttd: number | null;
  created_at: string | null;
}

interface Payment {
  id: string;
  amount_ttd: number;
  payment_method: string;
  payment_reference: string | null;
  status: string;
  period_start: string | null;
  period_end: string | null;
  confirmed_at: string | null;
  notes: string | null;
  created_at: string | null;
}

export function SubscriptionPage({ onNavigate }: SubscriptionPageProps) {
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBank, setEditingBank] = useState(false);
  const [saving, setSaving] = useState(false);
  const [bankDetails, setBankDetails] = useState({
    bank_name: '',
    account_name: '',
    account_number: '',
    routing_number: '',
  });

  useEffect(() => {
    if (user) fetchSubscription();
  }, [user]);

  const fetchSubscription = async () => {
    try {
      const { data: sub } = await supabase
        .from('business_subscriptions')
        .select('*')
        .eq('business_user_id', user!.id)
        .maybeSingle();

      if (sub) {
        setSubscription(sub);
        setBankDetails({
          bank_name: sub.billing_bank_name || '',
          account_name: sub.billing_bank_account_name || '',
          account_number: sub.billing_bank_account_number || '',
          routing_number: sub.billing_bank_routing_number || '',
        });

        const { data: paymentData } = await supabase
          .from('subscription_payments')
          .select('*')
          .eq('subscription_id', sub.id)
          .order('created_at', { ascending: false });

        if (paymentData) setPayments(paymentData);
      }
    } catch (err) {
      console.error('Error fetching subscription:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBank = async () => {
    if (!subscription) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_subscriptions')
        .update({
          billing_bank_name: bankDetails.bank_name,
          billing_bank_account_name: bankDetails.account_name,
          billing_bank_account_number: bankDetails.account_number,
          billing_bank_routing_number: bankDetails.routing_number || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', subscription.id);

      if (error) throw error;
      await fetchSubscription();
      setEditingBank(false);
    } catch (err) {
      console.error('Error updating bank details:', err);
    } finally {
      setSaving(false);
    }
  };

  const getStatusConfig = (status: string) => {
    const configs: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle }> = {
      trial: { label: 'Free Trial', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: Sparkles },
      active: { label: 'Active', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: CheckCircle },
      past_due: { label: 'Past Due', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: AlertTriangle },
      suspended: { label: 'Suspended', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: XCircle },
      cancelled: { label: 'Cancelled', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200', icon: XCircle },
    };
    return configs[status] || configs.active;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-TT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getDaysRemaining = () => {
    if (!subscription?.trial_end_date) return 0;
    const end = new Date(subscription.trial_end_date);
    const now = new Date();
    const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, diff);
  };

  const getMaskedAccount = (num: string | null) => {
    if (!num || num.length < 4) return num || '';
    return '****' + num.slice(-4);
  };

  const backPath = profile?.business_type === 'haulage'
    ? '/business/profile'
    : '/business/profile';

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!subscription) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => onNavigate(backPath)} className="flex items-center gap-2 text-gray-600 mb-4">
            <ArrowLeft className="w-5 h-5" /> Back
          </button>
          <div className="bg-white rounded-xl shadow-sm p-8 text-center">
            <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-gray-900">No Subscription Found</h2>
            <p className="text-gray-500 mt-2">Contact support if you believe this is an error.</p>
          </div>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(subscription.status);
  const StatusIcon = statusConfig.icon;
  const daysRemaining = getDaysRemaining();

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-6">
        <div className="max-w-2xl mx-auto">
          <button onClick={() => onNavigate(backPath)} className="flex items-center gap-2 text-white/80 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="w-5 h-5" /> Back to Profile
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <CreditCard className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Subscription</h1>
              <p className="text-blue-100 text-sm">Manage your MoveMe TT business plan</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <div className={`border rounded-xl p-5 ${statusConfig.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StatusIcon className={`w-6 h-6 ${statusConfig.color}`} />
              <div>
                <h3 className={`font-semibold ${statusConfig.color}`}>{statusConfig.label}</h3>
                <p className="text-sm text-gray-600">
                  {subscription.status === 'trial'
                    ? `${daysRemaining} days remaining in your free trial`
                    : subscription.status === 'active'
                    ? 'Your subscription is active and in good standing'
                    : subscription.status === 'past_due'
                    ? 'Payment is overdue. Please make a payment to continue access.'
                    : subscription.status === 'suspended'
                    ? 'Your account is suspended. Contact support for assistance.'
                    : 'Your subscription has been cancelled.'}
                </p>
              </div>
            </div>
          </div>

          {subscription.status === 'trial' && (
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Trial progress</span>
                <span>{daysRemaining} days left</span>
              </div>
              <div className="w-full bg-white/60 rounded-full h-2.5">
                <div
                  className="bg-emerald-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.max(5, 100 - (daysRemaining / 90) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            Plan Details
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Plan</p>
              <p className="text-sm font-medium text-gray-900">Monthly Business</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Monthly Price</p>
              <p className="text-sm font-medium text-gray-900">
                TT${subscription.monthly_amount_ttd.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                {subscription.status === 'trial' ? 'Trial Started' : 'Current Period Start'}
              </p>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(subscription.status === 'trial' ? subscription.trial_start_date : subscription.current_period_start)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">
                {subscription.status === 'trial' ? 'Trial Ends' : 'Next Billing Date'}
              </p>
              <p className="text-sm font-medium text-gray-900">
                {formatDate(subscription.status === 'trial' ? subscription.trial_end_date : subscription.next_billing_date)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-gray-500" />
              Payment Method
            </h3>
            {!editingBank && (
              <button
                onClick={() => setEditingBank(true)}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <Edit3 className="w-4 h-4" /> Edit
              </button>
            )}
          </div>

          {editingBank ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Bank Name</label>
                <select
                  value={bankDetails.bank_name}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, bank_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select bank</option>
                  <option value="Republic Bank">Republic Bank</option>
                  <option value="Scotiabank Trinidad & Tobago">Scotiabank Trinidad & Tobago</option>
                  <option value="First Citizens Bank">First Citizens Bank</option>
                  <option value="RBC Royal Bank">RBC Royal Bank</option>
                  <option value="JMMB Bank">JMMB Bank</option>
                  <option value="Citibank Trinidad & Tobago">Citibank Trinidad & Tobago</option>
                  <option value="Bank of Baroda">Bank of Baroda</option>
                  <option value="Intercommercial Bank">Intercommercial Bank</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account Holder</label>
                <input
                  type="text"
                  value={bankDetails.account_name}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, account_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Account Number</label>
                <input
                  type="text"
                  value={bankDetails.account_number}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, account_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Routing Number</label>
                <input
                  type="text"
                  value={bankDetails.routing_number}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, routing_number: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setEditingBank(false)}
                  className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 flex items-center gap-1"
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  onClick={handleSaveBank}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Shield className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{subscription.billing_bank_name}</p>
                  <p className="text-xs text-gray-500">
                    {subscription.billing_bank_account_name} - Account ending in {getMaskedAccount(subscription.billing_bank_account_number)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-gray-500" />
            Payment History
          </h3>

          {payments.length === 0 ? (
            <div className="text-center py-6">
              <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {subscription.status === 'trial'
                  ? 'No payments yet - you are on your free trial'
                  : 'No payment records found'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      TT${payment.amount_ttd.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(payment.created_at)}
                      {payment.payment_reference && ` - Ref: ${payment.payment_reference}`}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    payment.status === 'confirmed'
                      ? 'bg-green-100 text-green-700'
                      : payment.status === 'pending'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {payment.status === 'confirmed' ? 'Confirmed' : payment.status === 'pending' ? 'Pending' : 'Rejected'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
