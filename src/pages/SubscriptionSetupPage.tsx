import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  CreditCard,
  Building2,
  Shield,
  Clock,
  Check,
  Loader2,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Landmark,
  LogOut,
} from 'lucide-react';

const MONTHLY_PRICE_TTD = 500;

const PLAN_FEATURES = [
  'Unlimited job listings and management',
  'Fleet and driver management tools',
  'Real-time delivery tracking',
  'Customer messaging system',
  'Performance analytics dashboard',
  'Priority customer support',
  'Company profile and branding',
  'Proof of delivery system',
];

interface SubscriptionSetupPageProps {
  onBack?: () => void;
}

export function SubscriptionSetupPage({ onBack }: SubscriptionSetupPageProps = {}) {
  const { user, refreshProfile, signOut } = useAuth();
  const [step, setStep] = useState<'info' | 'payment' | 'complete'>('info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [bankDetails, setBankDetails] = useState({
    bank_name: '',
    account_name: '',
    account_number: '',
    routing_number: '',
  });

  const handleStartTrial = async () => {
    if (!bankDetails.bank_name.trim() || !bankDetails.account_name.trim() || !bankDetails.account_number.trim()) {
      setError('Please fill in all required bank details');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setMonth(trialEnd.getMonth() + 3);

      const { error: subError } = await supabase
        .from('business_subscriptions')
        .insert({
          business_user_id: user!.id,
          plan_type: 'monthly',
          status: 'trial',
          trial_start_date: now.toISOString(),
          trial_end_date: trialEnd.toISOString(),
          current_period_start: now.toISOString(),
          current_period_end: trialEnd.toISOString(),
          monthly_amount_ttd: MONTHLY_PRICE_TTD,
          billing_bank_name: bankDetails.bank_name,
          billing_bank_account_name: bankDetails.account_name,
          billing_bank_account_number: bankDetails.account_number,
          billing_bank_routing_number: bankDetails.routing_number || null,
          payment_info_added_at: now.toISOString(),
          next_billing_date: trialEnd.toISOString(),
        });

      if (subError) throw subError;

      setStep('complete');
      await refreshProfile();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to set up subscription. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="inline-flex p-4 rounded-full bg-green-100 mb-6">
            <Check className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Trial Activated
          </h1>
          <p className="text-gray-600 mb-6">
            Your 3-month free trial is now active. You have full access to all MoveMe TT business features.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">Trial Period</span>
            </div>
            <p className="text-sm text-blue-800">
              Your trial runs until{' '}
              <span className="font-semibold">
                {new Date(new Date().setMonth(new Date().getMonth() + 3)).toLocaleDateString('en-TT', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              . After that, your subscription will be TT${MONTHLY_PRICE_TTD}/month.
            </p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-4 flex items-center justify-between">
          {onBack ? (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
            >
              <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="text-sm font-medium">Back</span>
            </button>
          ) : (
            <div />
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Sign Out</span>
          </button>
        </div>
        {step === 'info' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 p-8 text-white">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-7 h-7" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold">MoveMe TT Business</h1>
                    <p className="text-blue-100 text-sm">Professional delivery management</p>
                  </div>
                </div>
                <div className="mt-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">TT${MONTHLY_PRICE_TTD}</span>
                    <span className="text-blue-200">/month</span>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-1.5">
                    <Sparkles className="w-4 h-4 text-yellow-300" />
                    <span className="text-sm font-medium">First 3 months FREE</span>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Everything you need
                </h3>
                <ul className="space-y-3">
                  {PLAN_FEATURES.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-col justify-center">
              <div className="bg-white rounded-2xl shadow-xl p-8">
                <h2 className="text-xl font-bold text-gray-900 mb-2">Start Your Free Trial</h2>
                <p className="text-gray-500 text-sm mb-6">
                  To activate your 3-month free trial, we need your payment details on file.
                  You will not be charged until the trial ends.
                </p>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <Shield className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <p className="text-xs text-green-800">No charges during your 3-month trial period</p>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl">
                    <Clock className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <p className="text-xs text-blue-800">Cancel anytime before the trial ends</p>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                    <Landmark className="w-5 h-5 text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-800">Bank transfer payments - simple and secure</p>
                  </div>
                </div>

                <button
                  onClick={() => setStep('payment')}
                  className="w-full py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  Add Payment Details
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'payment' && (
          <div className="max-w-lg mx-auto">
            <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold">Payment Information</h1>
                    <p className="text-blue-100 text-sm">Bank account for subscription billing</p>
                  </div>
                </div>
              </div>

              <div className="p-8">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-green-900">
                      3-Month Free Trial - No charges today
                    </span>
                  </div>
                  <p className="text-xs text-green-700 mt-1 ml-7">
                    First payment of TT${MONTHLY_PRICE_TTD} due after trial ends
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <select
                        value={bankDetails.bank_name}
                        onChange={(e) => setBankDetails(prev => ({ ...prev, bank_name: e.target.value }))}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      >
                        <option value="">Select your bank</option>
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
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Account Holder Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bankDetails.account_name}
                      onChange={(e) => setBankDetails(prev => ({ ...prev, account_name: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Company or personal name on account"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Account Number <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={bankDetails.account_number}
                      onChange={(e) => setBankDetails(prev => ({ ...prev, account_number: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Your bank account number"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Routing / Transit Number
                    </label>
                    <input
                      type="text"
                      value={bankDetails.routing_number}
                      onChange={(e) => setBankDetails(prev => ({ ...prev, routing_number: e.target.value }))}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      placeholder="Optional"
                    />
                  </div>
                </div>

                {error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 mt-8">
                  <button
                    type="button"
                    onClick={() => setStep('info')}
                    className="px-5 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-all"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleStartTrial}
                    disabled={loading}
                    className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                  >
                    {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                    {loading ? 'Activating Trial...' : 'Start Free Trial'}
                  </button>
                </div>

                <p className="text-xs text-gray-400 text-center mt-4">
                  By continuing, you agree to the MoveMe TT Terms of Service and
                  authorize billing of TT${MONTHLY_PRICE_TTD}/month after the trial period.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
