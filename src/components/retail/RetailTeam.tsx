import { useState } from 'react';
import { UserPlus, Shield, ShieldCheck, MoreHorizontal, X, Mail, DollarSign } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  dailySpendLimit: number;
  avatarUrl?: string;
  status: 'active' | 'invited';
}

const MOCK_MEMBERS: TeamMember[] = [
  { id: '1', name: 'You (Owner)', email: 'owner@company.com', role: 'admin', dailySpendLimit: 0, status: 'active' },
];

export function RetailTeam({ embedded = false }: { embedded?: boolean }) {
  const [members, setMembers] = useState<TeamMember[]>(MOCK_MEMBERS);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'staff'>('staff');
  const [inviteLimit, setInviteLimit] = useState('5000');

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: inviteEmail.split('@')[0],
      email: inviteEmail,
      role: inviteRole,
      dailySpendLimit: Number(inviteLimit) || 5000,
      status: 'invited',
    };
    setMembers([...members, newMember]);
    setInviteEmail('');
    setInviteLimit('5000');
    setInviteRole('staff');
    setShowInvite(false);
  };

  const handleRemove = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
  };

  const roleIcon = (role: string) =>
    role === 'admin'
      ? <ShieldCheck className="w-3.5 h-3.5" />
      : <Shield className="w-3.5 h-3.5" />;

  const roleBadge = (role: string) => {
    const isAdmin = role === 'admin';
    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
        isAdmin ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-700'
      }`}>
        {roleIcon(role)}
        {isAdmin ? 'Admin' : 'Staff'}
      </span>
    );
  };

  const content = (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{members.length} team member{members.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
        >
          <UserPlus className="w-4 h-4" />
          Invite Team Member
        </button>
      </div>

      {showInvite && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Invite New Member</h3>
            <button onClick={() => setShowInvite(false)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="dispatcher@company.com"
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Role</label>
              <select
                value={inviteRole}
                onChange={e => setInviteRole(e.target.value as 'admin' | 'staff')}
                className="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none bg-white"
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Daily Spend Limit (TTD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="number"
                  value={inviteLimit}
                  onChange={e => setInviteLimit(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-slate-300 focus:border-slate-400 outline-none"
                />
              </div>
            </div>
          </div>
          <button
            onClick={handleInvite}
            disabled={!inviteEmail.trim()}
            className="px-5 py-2.5 bg-slate-800 text-white rounded-lg hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium"
          >
            Send Invitation
          </button>
        </div>
      )}

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="hidden md:grid grid-cols-4 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
          <span>Name</span>
          <span>Role</span>
          <span>Daily Spend Limit</span>
          <span className="text-right">Actions</span>
        </div>
        <div className="divide-y divide-slate-100">
          {members.map(member => (
            <div key={member.id} className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors items-center">
              <div className="flex items-center gap-3">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} alt={member.name} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-600">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{member.name}</p>
                  <p className="text-xs text-slate-400 truncate">{member.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {roleBadge(member.role)}
                {member.status === 'invited' && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-600 font-medium">Invited</span>
                )}
              </div>
              <div className="hidden md:block">
                <span className="text-sm font-medium text-slate-700">
                  {member.dailySpendLimit === 0 ? 'Unlimited' : `$${member.dailySpendLimit.toLocaleString()}`}
                </span>
              </div>
              <div className="flex justify-end">
                {member.id !== '1' && (
                  <button
                    onClick={() => handleRemove(member.id)}
                    className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <MoreHorizontal className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
          <Shield className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Team & Permissions</h2>
          <p className="text-sm text-gray-600">Manage dispatchers and access controls</p>
        </div>
      </div>
      {content}
    </div>
  );
}
