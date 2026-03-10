import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  Copy,
  Check,
  AlertTriangle,
  Smartphone,
  QrCode,
} from 'lucide-react';

interface Props {
  onStatusChange?: (enabled: boolean) => void;
}

type MfaStatus = 'loading' | 'disabled' | 'verifying' | 'enabled';

interface EnrollData {
  id: string;
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

export function TwoFactorSetup({ onStatusChange }: Props) {
  const [status, setStatus] = useState<MfaStatus>('loading');
  const [enrollData, setEnrollData] = useState<EnrollData | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [factorId, setFactorId] = useState<string | null>(null);

  useEffect(() => {
    checkMfaStatus();
  }, []);

  const checkMfaStatus = async () => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;

      const verifiedFactor = data.totp.find((f) => f.status === 'verified');
      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        setStatus('enabled');
      } else {
        setStatus('disabled');
      }
    } catch {
      setStatus('disabled');
    }
  };

  const handleEnroll = async () => {
    setError(null);
    setActionLoading(true);
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const unverified = factors?.totp.filter((f) => f.status === 'unverified') || [];
      for (const f of unverified) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }

      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App',
      });
      if (error) throw error;

      setEnrollData(data as EnrollData);
      setStatus('verifying');
    } catch (err: any) {
      setError(err.message || 'Failed to start 2FA setup');
    } finally {
      setActionLoading(false);
    }
  };

  const handleVerifyEnroll = async () => {
    if (!enrollData || verifyCode.length !== 6) return;
    setError(null);
    setActionLoading(true);

    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId: enrollData.id });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId: enrollData.id,
        challengeId: challengeData.id,
        code: verifyCode,
      });
      if (verifyError) throw verifyError;

      setFactorId(enrollData.id);
      setStatus('enabled');
      setEnrollData(null);
      setVerifyCode('');
      setSuccess('Two-factor authentication has been enabled');
      onStatusChange?.(true);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Invalid verification code. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!factorId) return;
    setError(null);
    setActionLoading(true);

    try {
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });
      if (challengeError) throw challengeError;

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: disableCode,
      });
      if (verifyError) throw verifyError;

      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });
      if (unenrollError) throw unenrollError;

      setFactorId(null);
      setStatus('disabled');
      setShowDisableConfirm(false);
      setDisableCode('');
      setSuccess('Two-factor authentication has been disabled');
      onStatusChange?.(false);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err.message || 'Invalid code. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelEnroll = async () => {
    if (enrollData) {
      await supabase.auth.mfa.unenroll({ factorId: enrollData.id });
    }
    setEnrollData(null);
    setVerifyCode('');
    setError(null);
    setStatus('disabled');
  };

  const copySecret = () => {
    if (enrollData?.totp.secret) {
      navigator.clipboard.writeText(enrollData.totp.secret);
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    }
  };

  if (status === 'loading') {
    return (
      <div className="p-4 flex items-center justify-center gap-2 text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking 2FA status...</span>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {success && (
        <div className="mx-4 mt-4 flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-xl animate-fade-in">
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {error && (
        <div className="mx-4 mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl animate-fade-in">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {status === 'enabled' && !showDisableConfirm && (
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">2FA is Active</p>
                <p className="text-xs text-emerald-600">Your account is protected</p>
              </div>
            </div>
            <button
              onClick={() => { setShowDisableConfirm(true); setError(null); }}
              className="text-xs font-medium text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
            >
              Disable
            </button>
          </div>
        </div>
      )}

      {status === 'enabled' && showDisableConfirm && (
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800">Disable Two-Factor Authentication?</p>
              <p className="text-xs text-amber-700 mt-1">
                This will reduce the security of your account. Enter a code from your authenticator app to confirm.
              </p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Verification Code</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="input-field text-center text-lg tracking-[0.5em] font-mono"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setShowDisableConfirm(false); setDisableCode(''); setError(null); }}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDisable}
              disabled={disableCode.length !== 6 || actionLoading}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldOff className="w-4 h-4" />}
              Disable 2FA
            </button>
          </div>
        </div>
      )}

      {status === 'disabled' && (
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-xs text-gray-500">Add an extra layer of security</p>
              </div>
            </div>
            <button
              onClick={handleEnroll}
              disabled={actionLoading}
              className="text-xs font-medium text-white bg-moveme-blue-600 hover:bg-moveme-blue-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
              Enable
            </button>
          </div>
        </div>
      )}

      {status === 'verifying' && enrollData && (
        <div className="p-4 space-y-5">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <QrCode className="w-6 h-6 text-blue-600" />
            </div>
            <h4 className="font-semibold text-gray-900 text-sm">Set Up Authenticator App</h4>
            <p className="text-xs text-gray-500 mt-1">
              Scan this QR code with Google Authenticator, Authy, or any TOTP-compatible app.
            </p>
          </div>

          <div className="flex justify-center">
            <div className="bg-white p-3 rounded-2xl border-2 border-gray-100 shadow-sm">
              <img
                src={enrollData.totp.qr_code}
                alt="2FA QR Code"
                className="w-48 h-48"
              />
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-center">Or enter this code manually:</p>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
              <code className="flex-1 text-xs font-mono text-gray-700 break-all select-all">
                {enrollData.totp.secret}
              </code>
              <button
                onClick={copySecret}
                className="flex-shrink-0 p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                {copiedSecret ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Enter the 6-digit code from your app
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="input-field text-center text-lg tracking-[0.5em] font-mono"
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleCancelEnroll}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleVerifyEnroll}
              disabled={verifyCode.length !== 6 || actionLoading}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verify & Enable
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
