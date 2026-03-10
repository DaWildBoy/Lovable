import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { isSuperAdmin, getAdminRoleLabel } from '../../lib/adminAuth';
import { logAuditAction } from './adminUtils';
import { resetPlatformFeeCache } from '../../lib/pricing';
import {
  Users,
  DollarSign,
  Bell,
  Shield,
  ChevronDown,
  ToggleLeft,
  ToggleRight,
  Loader2,
  ShieldCheck,
  Eye,
  Crown,
  UserPlus,
  Save,
  CheckCircle2,
} from 'lucide-react';
import { AddStaffModal } from './AddStaffModal';

interface AdminStaff {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  role: string;
  created_at: string | null;
  avatar_url: string | null;
}

interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

const ROLE_ICON_MAP: Record<string, typeof Shield> = {
  super_admin: Crown,
  support_admin: ShieldCheck,
  verification_admin: Eye,
};

const ROLE_COLOR_MAP: Record<string, { bg: string; text: string; border: string }> = {
  super_admin: { bg: 'bg-error-50', text: 'text-error-700', border: 'border-error-100' },
  support_admin: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-100' },
  verification_admin: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100' },
};

const ADMIN_ROLES = ['super_admin', 'support_admin', 'verification_admin'];

function ToggleSwitch({ enabled, onToggle, disabled }: ToggleSwitchProps) {
  return (
    <button onClick={onToggle} disabled={disabled} className="flex-shrink-0 disabled:opacity-50">
      {enabled ? (
        <ToggleRight className="w-8 h-8 text-moveme-blue-600" />
      ) : (
        <ToggleLeft className="w-8 h-8 text-gray-300" />
      )}
    </button>
  );
}

function RoleChangeDropdown({
  currentRole,
  userId,
  onChanged,
}: {
  currentRole: string;
  userId: string;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = async (newRole: string) => {
    if (newRole === currentRole) { setOpen(false); return; }
    setLoading(true);
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      await logAuditAction('change_role', 'user', userId, { from: currentRole, to: newRole });
      onChanged();
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const colors = ROLE_COLOR_MAP[currentRole] || ROLE_COLOR_MAP.support_admin;
  const Icon = ROLE_ICON_MAP[currentRole] || ShieldCheck;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={loading}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border} hover:opacity-80 transition-all`}
      >
        {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
        {getAdminRoleLabel(currentRole)}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-52 bg-white rounded-xl shadow-elevated border border-gray-200 py-1 z-40">
            {ADMIN_ROLES.map((r) => {
              const RIcon = ROLE_ICON_MAP[r] || ShieldCheck;
              const rc = ROLE_COLOR_MAP[r] || ROLE_COLOR_MAP.support_admin;
              return (
                <button
                  key={r}
                  onClick={() => handleChange(r)}
                  className={`w-full text-left px-3.5 py-2.5 hover:bg-gray-50 transition-colors ${r === currentRole ? 'bg-gray-50' : ''}`}
                >
                  <p className={`text-sm font-medium flex items-center gap-1.5 ${r === currentRole ? rc.text : 'text-gray-900'}`}>
                    <RIcon className="w-3.5 h-3.5" />
                    {getAdminRoleLabel(r)}
                  </p>
                  <p className="text-xs text-gray-400 ml-5">
                    {r === 'super_admin' && 'Full platform control'}
                    {r === 'support_admin' && 'Jobs, users, messages, companies'}
                    {r === 'verification_admin' && 'Verify couriers & businesses only'}
                  </p>
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

type SettingsMap = Record<string, string>;

export function AdminSettings() {
  const { profile } = useAuth();
  const isSA = isSuperAdmin(profile);

  const [settings, setSettings] = useState<SettingsMap>({});
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [feeCommission, setFeeCommission] = useState('7.5');
  const [feeMinJob, setFeeMinJob] = useState('50');
  const [feeSubscription, setFeeSubscription] = useState('500');
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [showAddStaff, setShowAddStaff] = useState(false);

  const fetchSettings = async () => {
    setSettingsLoading(true);
    try {
      const { data } = await supabase.from('platform_settings').select('key, value');
      const map: SettingsMap = {};
      (data || []).forEach((r: any) => { map[r.key] = r.value; });
      setSettings(map);
      setFeeCommission(map['platform_commission_percent'] || '7.5');
      setFeeMinJob(map['minimum_job_price_ttd'] || '50');
      setFeeSubscription(map['business_subscription_fee_ttd'] || '500');
    } finally { setSettingsLoading(false); }
  };

  const fetchStaff = async () => {
    setStaffLoading(true);
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id, email, full_name, first_name, role, created_at, avatar_url')
        .in('role', ADMIN_ROLES)
        .order('created_at', { ascending: true });
      setStaff((data || []) as AdminStaff[]);
    } finally { setStaffLoading(false); }
  };

  useEffect(() => { fetchStaff(); fetchSettings(); }, []);

  const updateSetting = async (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    await supabase.from('platform_settings').update({ value, updated_at: new Date().toISOString() }).eq('key', key);
    await logAuditAction('update_setting', 'settings', key, { value });
  };

  const toggleSetting = (key: string) => {
    const current = settings[key] === 'true';
    updateSetting(key, String(!current));
  };

  const saveFees = async () => {
    setSaving(true);
    try {
      await Promise.all([
        supabase.from('platform_settings').update({ value: feeCommission, updated_at: new Date().toISOString() }).eq('key', 'platform_commission_percent'),
        supabase.from('platform_settings').update({ value: feeMinJob, updated_at: new Date().toISOString() }).eq('key', 'minimum_job_price_ttd'),
        supabase.from('platform_settings').update({ value: feeSubscription, updated_at: new Date().toISOString() }).eq('key', 'business_subscription_fee_ttd'),
      ]);
      await logAuditAction('update_fees', 'settings', 'fees', { commission: feeCommission, min_job: feeMinJob, subscription: feeSubscription });
      resetPlatformFeeCache();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const staffByRole = ADMIN_ROLES.map((role) => ({
    role, label: getAdminRoleLabel(role), icon: ROLE_ICON_MAP[role], colors: ROLE_COLOR_MAP[role],
    members: staff.filter((s) => s.role === role),
  }));

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Platform configuration and preferences</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-moveme-blue-600" />
              <h2 className="text-base font-semibold text-gray-900">Admin Staff</h2>
            </div>
            <p className="text-xs text-gray-400 mt-1">{staff.length} team member{staff.length !== 1 ? 's' : ''}</p>
          </div>
          {isSA && (
            <button onClick={() => setShowAddStaff(true)} className="flex items-center gap-1.5 px-3.5 py-2 bg-moveme-blue-600 text-white rounded-xl text-xs font-medium hover:bg-moveme-blue-700 transition-colors shadow-sm">
              <UserPlus className="w-3.5 h-3.5" />Add Staff
            </button>
          )}
        </div>
        {staffLoading ? (
          <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 text-moveme-blue-600 animate-spin" /></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {staffByRole.map((group) => {
              if (group.members.length === 0) return null;
              const GroupIcon = group.icon;
              return (
                <div key={group.role}>
                  <div className="px-5 py-2.5 bg-gray-50/50 flex items-center gap-2">
                    <GroupIcon className={`w-3.5 h-3.5 ${group.colors.text}`} />
                    <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{group.label} ({group.members.length})</span>
                  </div>
                  {group.members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-lg ${group.colors.bg} flex items-center justify-center flex-shrink-0`}>
                          <span className={`text-xs font-bold ${group.colors.text}`}>{(member.full_name || member.first_name || member.email || '?').charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {member.full_name || member.first_name || 'Unnamed'}
                            {member.id === profile?.id && <span className="text-[10px] font-medium text-gray-400 ml-1.5">(you)</span>}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{member.email}</p>
                        </div>
                      </div>
                      {isSA && member.id !== profile?.id ? (
                        <RoleChangeDropdown currentRole={member.role} userId={member.id} onChanged={fetchStaff} />
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${group.colors.bg} ${group.colors.text}`}>
                          <GroupIcon className="w-3 h-3" />{group.label}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
        <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100">
          <div className="flex items-start gap-2">
            <Shield className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-gray-400 space-y-0.5">
              <p><strong className="text-gray-500">Super Admin</strong> -- Full platform control.</p>
              <p><strong className="text-gray-500">Support Admin</strong> -- Manages users, jobs, messages, companies.</p>
              <p><strong className="text-gray-500">Verification Admin</strong> -- Verify couriers & businesses only.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-success-600" /><h2 className="text-base font-semibold text-gray-900">Fee Settings</h2></div>
            <p className="text-xs text-gray-400 mt-1">Platform commission and pricing rules</p>
          </div>
          {isSA && (
            <button onClick={saveFees} disabled={saving || settingsLoading} className="flex items-center gap-1.5 px-3.5 py-2 bg-success-600 text-white rounded-xl text-xs font-medium hover:bg-success-700 transition-colors disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? 'Saved' : 'Save Fees'}
            </button>
          )}
        </div>
        <div className="divide-y divide-gray-50">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div><p className="text-sm font-medium text-gray-900">Platform Commission</p><p className="text-xs text-gray-400">Percentage charged on each delivery</p></div>
            {isSA ? (
              <div className="flex items-center gap-1">
                <input type="number" value={feeCommission} onChange={(e) => setFeeCommission(e.target.value)} className="w-16 text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg text-right focus:ring-1 focus:ring-moveme-blue-500 focus:bg-white border border-transparent focus:border-moveme-blue-500 outline-none transition-all" />
                <span className="text-sm text-gray-500">%</span>
              </div>
            ) : <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">{settings['platform_commission_percent'] || '7.5'}%</span>}
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div><p className="text-sm font-medium text-gray-900">Minimum Job Price</p><p className="text-xs text-gray-400">Lowest price allowed for a delivery</p></div>
            {isSA ? (
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">TT$</span>
                <input type="number" value={feeMinJob} onChange={(e) => setFeeMinJob(e.target.value)} className="w-20 text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg text-right focus:ring-1 focus:ring-moveme-blue-500 focus:bg-white border border-transparent focus:border-moveme-blue-500 outline-none transition-all" />
              </div>
            ) : <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">TT${settings['minimum_job_price_ttd'] || '50'}</span>}
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div><p className="text-sm font-medium text-gray-900">Business Subscription Fee</p><p className="text-xs text-gray-400">Monthly fee for business accounts</p></div>
            {isSA ? (
              <div className="flex items-center gap-1">
                <span className="text-sm text-gray-500">TT$</span>
                <input type="number" value={feeSubscription} onChange={(e) => setFeeSubscription(e.target.value)} className="w-20 text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1.5 rounded-lg text-right focus:ring-1 focus:ring-moveme-blue-500 focus:bg-white border border-transparent focus:border-moveme-blue-500 outline-none transition-all" />
                <span className="text-sm text-gray-500">/mo</span>
              </div>
            ) : <span className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">TT${settings['business_subscription_fee_ttd'] || '500'}/mo</span>}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Bell className="w-5 h-5 text-warning-600" /><h2 className="text-base font-semibold text-gray-900">Notification Settings</h2></div>
          <p className="text-xs text-gray-400 mt-1">Admin notification preferences</p>
        </div>
        <div className="divide-y divide-gray-50">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div><p className="text-sm font-medium text-gray-900">Email Notifications</p><p className="text-xs text-gray-400">Receive admin alerts via email</p></div>
            <ToggleSwitch enabled={settings['email_notifications'] === 'true'} onToggle={() => toggleSetting('email_notifications')} disabled={!isSA || settingsLoading} />
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div><p className="text-sm font-medium text-gray-900">Push Notifications</p><p className="text-xs text-gray-400">Browser push notifications for urgent alerts</p></div>
            <ToggleSwitch enabled={settings['push_notifications'] === 'true'} onToggle={() => toggleSetting('push_notifications')} disabled={!isSA || settingsLoading} />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2"><Shield className="w-5 h-5 text-error-600" /><h2 className="text-base font-semibold text-gray-900">Platform Controls</h2></div>
          <p className="text-xs text-gray-400 mt-1">System-wide settings and controls</p>
        </div>
        <div className="divide-y divide-gray-50">
          <div className="flex items-center justify-between px-5 py-3.5">
            <div><p className="text-sm font-medium text-gray-900">Maintenance Mode</p><p className="text-xs text-gray-400">Temporarily disable the platform for maintenance</p></div>
            <ToggleSwitch enabled={settings['maintenance_mode'] === 'true'} onToggle={() => toggleSetting('maintenance_mode')} disabled={!isSA || settingsLoading} />
          </div>
          <div className="flex items-center justify-between px-5 py-3.5">
            <div><p className="text-sm font-medium text-gray-900">Auto-approve Couriers</p><p className="text-xs text-gray-400">Skip manual verification for new couriers</p></div>
            <ToggleSwitch enabled={settings['auto_approve_couriers'] === 'true'} onToggle={() => toggleSetting('auto_approve_couriers')} disabled={!isSA || settingsLoading} />
          </div>
        </div>
      </div>

      {showAddStaff && <AddStaffModal onClose={() => setShowAddStaff(false)} onCreated={fetchStaff} />}
    </div>
  );
}
