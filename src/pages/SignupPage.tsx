import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RoleSelection } from '../components/RoleSelection';
import { ArrowLeft, Loader2, Mail, Lock, ArrowRight, RefreshCw, CheckCircle } from 'lucide-react';
import { MoveMeLogo } from '../components/MoveMeLogo';
import { TermsOfServiceModal, TERMS_VERSION } from '../components/TermsOfServiceModal';

export function SignupPage({ onSwitchToLogin }: { onSwitchToLogin: () => void }) {
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const { signUp } = useAuth();

  const handleContinue = () => {
    if (!selectedRole) {
      setError('Please select a role');
      return;
    }
    setShowForm(true);
    setError('');
  };

  const handleResendEmail = async () => {
    setResending(true);
    setResendSuccess(false);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
      });
      if (error) throw error;
      setResendSuccess(true);
      setTimeout(() => setResendSuccess(false), 4000);
    } catch {
      setError('Could not resend email. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedRole === 'customer' && !termsAccepted) {
      setError('You must accept the Terms of Service to create an account');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, selectedRole!);

      if (selectedRole === 'customer') {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await supabase
            .from('profiles')
            .update({
              terms_accepted_at: new Date().toISOString(),
              terms_version: TERMS_VERSION,
            })
            .eq('id', session.user.id);
        }
      }

      setPendingVerification(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('user already registered') || msg.includes('already_exists')) {
          setError('An account with this email already exists. Please log in instead.');
        } else {
          setError(err.message);
        }
      } else {
        setError('An error occurred during signup');
      }
    } finally {
      setLoading(false);
    }
  };

  if (pendingVerification) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-moveme-blue-50 via-white to-moveme-teal-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md animate-fade-in-up">
          <div className="card p-8 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-moveme-blue-100 mb-6">
              <Mail className="w-8 h-8 text-moveme-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">Check Your Email</h1>
            <p className="text-gray-500 text-sm mb-1">We sent a verification link to</p>
            <p className="text-base font-semibold text-gray-900 mb-6">{email}</p>

            <div className="bg-moveme-blue-50 border border-moveme-blue-100 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm text-gray-700 leading-relaxed">
                Click the link in your email to verify your account. Once verified, you can log in and start using MoveMe TT.
              </p>
            </div>

            {error && (
              <div className="p-3.5 bg-error-50 border border-error-200 rounded-xl mb-4 animate-fade-in">
                <p className="text-sm text-error-600 font-medium">{error}</p>
              </div>
            )}

            {resendSuccess && (
              <div className="p-3.5 bg-success-50 border border-success-200 rounded-xl mb-4 animate-fade-in flex items-center gap-2 justify-center">
                <CheckCircle className="w-4 h-4 text-success-600" />
                <p className="text-sm text-success-700 font-medium">Verification email resent</p>
              </div>
            )}

            <button
              onClick={handleResendEmail}
              disabled={resending}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors mb-3"
            >
              {resending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              Resend Verification Email
            </button>

            <button
              onClick={onSwitchToLogin}
              className="btn-primary w-full py-3 text-sm"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!showForm) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-moveme-blue-50 via-white to-moveme-teal-50 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl animate-fade-in-up">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center mb-4">
              <MoveMeLogo className="h-28 w-auto drop-shadow-lg [&>svg]:h-28 [&>svg]:w-auto" />
            </div>
            <p className="text-gray-500 text-sm">
              Trinidad & Tobago's premier logistics marketplace
            </p>
          </div>

          <div className="card p-6 md:p-8">
            <RoleSelection selectedRole={selectedRole} onSelectRole={setSelectedRole} />

            {error && (
              <div className="mt-5 p-3.5 bg-error-50 border border-error-200 rounded-xl animate-fade-in">
                <p className="text-sm text-error-600 font-medium">{error}</p>
              </div>
            )}

            <div className="mt-8">
              <button
                onClick={handleContinue}
                disabled={!selectedRole}
                className="btn-primary w-full py-3.5 text-base"
              >
                Continue
                <ArrowRight className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <p className="text-center mt-6 text-sm text-gray-500">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="font-semibold text-moveme-blue-600 hover:text-moveme-blue-700 transition-colors"
            >
              Login
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-moveme-blue-50 via-white to-moveme-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="card p-8">
          <button
            onClick={() => setShowForm(false)}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors mb-6 text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to role selection
          </button>

          <div className="mb-7">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">Create Account</h1>
            <p className="text-gray-500 text-sm">
              Signing up as a <span className="font-semibold text-moveme-blue-600 capitalize">{selectedRole}</span>
            </p>
          </div>

          <form onSubmit={handleSignup} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field-with-icon"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field-with-icon"
                  placeholder="At least 6 characters"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-gray-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field-with-icon"
                  placeholder="Re-enter password"
                  required
                />
              </div>
            </div>

            {selectedRole === 'customer' && (
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms-checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-moveme-blue-600 focus:ring-moveme-blue-500 cursor-pointer flex-shrink-0"
                />
                <label htmlFor="terms-checkbox" className="text-sm text-gray-600 leading-relaxed cursor-pointer">
                  I have read and agree to the{' '}
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}
                    className="font-semibold text-moveme-blue-600 hover:text-moveme-blue-700 underline underline-offset-2 transition-colors"
                  >
                    Terms of Service
                  </button>
                </label>
              </div>
            )}

            {error && (
              <div className="p-3.5 bg-error-50 border border-error-200 rounded-xl animate-fade-in">
                <p className="text-sm text-error-600 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || (selectedRole === 'customer' && !termsAccepted)}
              className="btn-primary w-full py-3.5 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Sign Up
                  <ArrowRight className="w-4.5 h-4.5" />
                </>
              )}
            </button>
          </form>
        </div>

        <p className="text-center mt-6 text-sm text-gray-500">
          Already have an account?{' '}
          <button
            onClick={onSwitchToLogin}
            className="font-semibold text-moveme-blue-600 hover:text-moveme-blue-700 transition-colors"
          >
            Login
          </button>
        </p>
      </div>

      <TermsOfServiceModal open={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
}
