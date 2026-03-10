import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { getAdminRoleLabel } from '../../lib/adminAuth';
import {
  Lock, Loader2, CheckCircle2, AlertTriangle,
  User, Mail, Phone, Shield, Eye, EyeOff,
} from 'lucide-react';

export function AdminProfile() {
  const { profile } = useAuth();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const [firstName, setFirstName] = useState(profile?.first_name || '');
  const [lastName, setLastName] = useState(profile?.last_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoResult, setInfoResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const displayName = profile?.full_name || [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || 'Admin';

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwResult(null);

    if (newPassword.length < 6) {
      setPwResult({ ok: false, msg: 'New password must be at least 6 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwResult({ ok: false, msg: 'Passwords do not match' });
      return;
    }

    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPwResult({ ok: true, msg: 'Password updated successfully' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update password';
      setPwResult({ ok: false, msg: message });
    } finally {
      setPwLoading(false);
    }
  };

  const handleInfoUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setInfoResult(null);
    setInfoLoading(true);

    try {
      const fullName = [firstName, lastName].filter(Boolean).join(' ') || null;
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: fullName,
          phone: phone || null,
        })
        .eq('id', profile!.id);

      if (error) throw error;
      setInfoResult({ ok: true, msg: 'Profile updated successfully' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setInfoResult({ ok: false, msg: message });
    } finally {
      setInfoLoading(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your account information and security</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 flex items-center gap-4">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-moveme-blue-100 flex items-center justify-center">
              <span className="text-2xl font-bold text-moveme-blue-700">
                {displayName.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div>
            <h2 className="text-lg font-bold text-gray-900">{displayName}</h2>
            <p className="text-sm text-gray-500">{profile?.email}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <Shield className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-xs font-medium text-gray-500">
                {getAdminRoleLabel(profile?.role || '')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-moveme-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Personal Information</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">Update your name and contact details</p>
        </div>
        <form onSubmit={handleInfoUpdate} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                value={profile?.email || ''}
                disabled
                className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (868) 000-0000"
                className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
              />
            </div>
          </div>

          {infoResult && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
              infoResult.ok ? 'bg-success-50 text-success-700 border border-success-100' : 'bg-error-50 text-error-700 border border-error-100'
            }`}>
              {infoResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              {infoResult.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={infoLoading}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-moveme-blue-600 text-white rounded-xl text-sm font-medium hover:bg-moveme-blue-700 disabled:opacity-50 transition-colors"
          >
            {infoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Save Changes
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 text-error-600" />
            <h2 className="text-base font-semibold text-gray-900">Change Password</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">Update your account password</p>
        </div>
        <form onSubmit={handlePasswordChange} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Current Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Confirm New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
              />
            </div>
          </div>

          {pwResult && (
            <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm ${
              pwResult.ok ? 'bg-success-50 text-success-700 border border-success-100' : 'bg-error-50 text-error-700 border border-error-100'
            }`}>
              {pwResult.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
              {pwResult.msg}
            </div>
          )}

          <button
            type="submit"
            disabled={pwLoading || !newPassword || !confirmPassword}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-error-600 text-white rounded-xl text-sm font-medium hover:bg-error-700 disabled:opacity-50 transition-colors"
          >
            {pwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            Update Password
          </button>
        </form>
      </div>
    </div>
  );
}
