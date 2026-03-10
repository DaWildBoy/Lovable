import { useState } from 'react';
import { ArrowLeft, Lock, Eye, EyeOff, Loader2, CheckCircle, Shield, KeyRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { TwoFactorSetup } from '../../components/TwoFactorSetup';

interface Props {
  onNavigate: (path: string) => void;
}

export function CustomerSecurityPage({ onNavigate }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChangePassword = async () => {
    setError(null);
    setSuccess(false);

    if (!newPassword || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 animate-fade-in-up">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate('/customer/profile')}
            className="flex items-center gap-1.5 text-moveme-blue-600 hover:text-moveme-blue-700 font-medium mb-3 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Security</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your password and account security</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Lock className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Change Password</h3>
              <p className="text-xs text-gray-500">Update your account password</p>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="input-field pr-10"
                />
                <button
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="input-field pr-10"
                />
                <button
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-xl">
                <Shield className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-3 rounded-xl">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <p className="text-sm">Password updated successfully</p>
              </div>
            )}

            <button
              onClick={handleChangePassword}
              disabled={saving || !newPassword || !confirmPassword}
              className="w-full btn-primary"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Update Password'
              )}
            </button>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 text-sm">Account Security</h3>
              <p className="text-xs text-gray-500">Additional security options</p>
            </div>
          </div>

          <div className="divide-y divide-gray-50">
            <TwoFactorSetup />
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <KeyRound className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">Active Sessions</p>
                  <p className="text-xs text-gray-500">Manage your logged-in devices</p>
                </div>
              </div>
              <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Coming Soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
