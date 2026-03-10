import { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin } from '../../lib/adminAuth';
import {
  X, Loader2, UserPlus, Mail, Lock, Phone, User,
  ChevronDown, CheckCircle2, Shield, ShieldCheck, Eye,
} from 'lucide-react';

interface AddStaffModalProps {
  onClose: () => void;
  onCreated: () => void;
}

const USER_ROLES = [
  { value: 'customer', label: 'Customer', desc: 'Standard customer account', group: 'user' },
  { value: 'courier', label: 'Courier', desc: 'Delivery driver account', group: 'user' },
  { value: 'business', label: 'Business', desc: 'Retail or haulage business', group: 'user' },
];

const ADMIN_ROLES = [
  { value: 'verification_admin', label: 'Verification Admin', desc: 'Can only verify couriers and businesses', group: 'admin', icon: Eye },
  { value: 'support_admin', label: 'Support Admin', desc: 'User support, jobs, messages, and companies', group: 'admin', icon: ShieldCheck },
  { value: 'super_admin', label: 'Super Admin', desc: 'Full platform control (owners/developers only)', group: 'admin', icon: Shield },
];

export function AddStaffModal({ onClose, onCreated }: AddStaffModalProps) {
  const { profile } = useAuth();
  const isSA = isSuperAdmin(profile);
  const allRoles = [...USER_ROLES, ...(isSA ? ADMIN_ROLES : [])];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('support_admin');
  const [roleOpen, setRoleOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const selectedRole = allRoles.find((r) => r.value === role) || allRoles[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !role) return;
    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ email, password, firstName, lastName, phone, role }),
        }
      );

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Server error (${res.status})`);
      }
      if (!res.ok) throw new Error(data.error || data.msg || `Failed to create user (${res.status})`);

      setSuccess(true);
      setTimeout(() => {
        onCreated();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-elevated w-full max-w-md animate-scale-in overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-moveme-blue-50 flex items-center justify-center">
              <UserPlus className="w-4.5 h-4.5 text-moveme-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">Add New User</h2>
              <p className="text-xs text-gray-400">Create an account with a specific role</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="px-6 py-12 text-center">
            <div className="w-14 h-14 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-success-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-1">User Created</h3>
            <p className="text-sm text-gray-500">The new {selectedRole.label.toLowerCase()} account is ready.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">First Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="John"
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
                  placeholder="Doe"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Email *</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Password *</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
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

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Role *</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleOpen(!roleOpen)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border border-gray-200 rounded-xl text-sm hover:border-gray-300 focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all text-left"
                >
                  <div>
                    <span className="font-medium text-gray-900">{selectedRole.label}</span>
                    <span className="text-gray-400 ml-2 text-xs">{selectedRole.desc}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${roleOpen ? 'rotate-180' : ''}`} />
                </button>
                {roleOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setRoleOpen(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-elevated border border-gray-200 py-1 z-40 max-h-64 overflow-y-auto">
                      {isSA && (
                        <div className="px-4 pt-2 pb-1">
                          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Admin Roles</p>
                        </div>
                      )}
                      {isSA && ADMIN_ROLES.map((r) => {
                        const Icon = r.icon;
                        return (
                          <button
                            key={r.value}
                            type="button"
                            onClick={() => { setRole(r.value); setRoleOpen(false); }}
                            className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                              role === r.value ? 'bg-moveme-blue-50/50' : ''
                            }`}
                          >
                            <p className={`text-sm font-medium flex items-center gap-1.5 ${role === r.value ? 'text-moveme-blue-700' : 'text-gray-900'}`}>
                              <Icon className="w-3.5 h-3.5" />
                              {r.label}
                            </p>
                            <p className="text-xs text-gray-400 ml-5">{r.desc}</p>
                          </button>
                        );
                      })}
                      <div className="px-4 pt-2 pb-1 border-t border-gray-100 mt-1">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">User Roles</p>
                      </div>
                      {USER_ROLES.map((r) => (
                        <button
                          key={r.value}
                          type="button"
                          onClick={() => { setRole(r.value); setRoleOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors ${
                            role === r.value ? 'bg-moveme-blue-50/50' : ''
                          }`}
                        >
                          <p className={`text-sm font-medium ${role === r.value ? 'text-moveme-blue-700' : 'text-gray-900'}`}>
                            {r.label}
                          </p>
                          <p className="text-xs text-gray-400">{r.desc}</p>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {error && (
              <div className="bg-error-50 text-error-700 text-sm px-4 py-3 rounded-xl border border-error-100">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !email || !password}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-moveme-blue-600 text-white rounded-xl text-sm font-medium hover:bg-moveme-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Create User
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
