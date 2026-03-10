import { useState } from 'react';
import { Mail, RefreshCw, Loader2, CheckCircle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export function EmailVerificationPage() {
  const { user, signOut } = useAuth();
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleResend = async () => {
    if (!user?.email) return;
    setResending(true);
    setError('');
    setResendSuccess(false);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-moveme-blue-50 via-white to-moveme-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="card p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-moveme-blue-100 mb-6">
            <Mail className="w-8 h-8 text-moveme-blue-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
            Verify Your Email
          </h1>

          <p className="text-gray-500 text-sm mb-1">We sent a verification link to</p>
          <p className="text-base font-semibold text-gray-900 mb-6">{user?.email}</p>

          <div className="bg-moveme-blue-50 border border-moveme-blue-100 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-gray-700 leading-relaxed">
              Please check your inbox and click the verification link to continue. If you don't see it, check your spam folder.
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
            onClick={() => window.location.reload()}
            className="btn-primary w-full py-3 text-sm mb-3"
          >
            I've Verified My Email
          </button>

          <button
            onClick={handleResend}
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
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-gray-400 hover:text-gray-600 text-sm transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out and use a different email
          </button>
        </div>
      </div>
    </div>
  );
}
