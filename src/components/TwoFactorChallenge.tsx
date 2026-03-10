import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import { MoveMeLogo } from './MoveMeLogo';

interface Props {
  onVerified: () => void;
  onCancel: () => void;
}

export function TwoFactorChallenge({ onVerified, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [checkingFactors, setCheckingFactors] = useState(true);

  useEffect(() => {
    loadFactor();
  }, []);

  const loadFactor = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const verified = data.totp.find((f) => f.status === 'verified');
      if (verified) {
        setFactorId(verified.id);
      } else {
        onVerified();
      }
    } catch {
      onVerified();
    } finally {
      setCheckingFactors(false);
    }
  };

  const handleVerify = async () => {
    if (!factorId || code.length !== 6) return;
    setError(null);
    setLoading(true);

    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code,
      });
      if (verifyError) throw verifyError;

      onVerified();
    } catch (err: any) {
      setError('Invalid verification code. Please try again.');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && code.length === 6 && !loading) {
      handleVerify();
    }
  };

  if (checkingFactors) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-moveme-blue-50 via-white to-moveme-teal-50 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Verifying security...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-moveme-blue-50 via-white to-moveme-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <MoveMeLogo className="h-20 w-auto drop-shadow-lg [&>svg]:h-20 [&>svg]:w-auto" />
          </div>
        </div>

        <div className="card p-8">
          <div className="text-center mb-6">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Shield className="w-7 h-7 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Two-Factor Verification</h2>
            <p className="text-sm text-gray-500 mt-1">
              Enter the 6-digit code from your authenticator app to continue.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onKeyDown={handleKeyDown}
                placeholder="000000"
                className="input-field text-center text-2xl tracking-[0.5em] font-mono py-4"
                autoFocus
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl animate-fade-in">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={code.length !== 6 || loading}
              className="btn-primary w-full py-3.5 text-base"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify'
              )}
            </button>

            <button
              onClick={onCancel}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors py-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
