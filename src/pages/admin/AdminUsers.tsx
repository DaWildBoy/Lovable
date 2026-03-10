import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search, ChevronDown, ArrowUpRight, Star, Users, Loader2,
  ShieldCheck, Clock, Building2, Truck, Store, UserPlus, Filter, Download,
} from 'lucide-react';
import type { AdminProfile, AdminTab } from './AdminUserTypes';
import { ROLE_COLORS } from './AdminUserTypes';
import { AdminUserDrawer } from './AdminUserDrawer';
import { AddStaffModal } from './AddStaffModal';
import { useAuth } from '../../contexts/AuthContext';
import { canCreateUsers } from '../../lib/adminAuth';
import { Pagination, usePagination } from './Pagination';
import { exportToCsv } from './adminUtils';

const TABS: { key: AdminTab; label: string; icon: typeof Users }[] = [
  { key: 'all', label: 'All Users', icon: Users },
  { key: 'verified', label: 'Verified', icon: ShieldCheck },
  { key: 'pending', label: 'Pending Verification', icon: Clock },
  { key: 'retail', label: 'Retail Business', icon: Store },
  { key: 'haulage', label: 'Haulage', icon: Truck },
];

const ROLE_OPTIONS = ['All', 'Customer', 'Courier', 'Business', 'Support Admin', 'Verification Admin', 'Super Admin'];
const ROLE_MAP: Record<string, string> = {
  Customer: 'customer', Courier: 'courier', Business: 'business',
  'Support Admin': 'support_admin', 'Verification Admin': 'verification_admin',
  'Super Admin': 'super_admin',
};

interface CourierVerifMap {
  [userId: string]: { verified: boolean | null; verification_status: string | null };
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  support_admin: 'Support Admin',
  verification_admin: 'Verification Admin',
};

function RoleBadge({ role }: { role: string | null }) {
  const r = role || 'customer';
  const label = ROLE_LABELS[r] || r.charAt(0).toUpperCase() + r.slice(1);
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[r] || ROLE_COLORS.customer}`}>
      {label}
    </span>
  );
}

function VerifBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const colors: Record<string, string> = {
    approved: 'bg-success-50 text-success-700',
    verified: 'bg-success-50 text-success-700',
    rejected: 'bg-error-50 text-error-700',
    pending: 'bg-warning-50 text-warning-700',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-500'}`}>
      {status === 'approved' || status === 'verified' ? <ShieldCheck className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function AdminUsers() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<AdminProfile[]>([]);
  const [courierVerif, setCourierVerif] = useState<CourierVerifMap>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('all');
  const [selected, setSelected] = useState<AdminProfile | null>(null);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [page, setPage] = useState(1);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setUsers((data || []) as AdminProfile[]);

      const { data: couriers } = await supabase
        .from('couriers')
        .select('user_id, verified, verification_status');
      if (couriers) {
        const map: CourierVerifMap = {};
        couriers.forEach((c: { user_id: string; verified: boolean | null; verification_status: string | null }) => {
          map[c.user_id] = { verified: c.verified, verification_status: c.verification_status };
        });
        setCourierVerif(map);
      }
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-users-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchUsers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getVerificationStatus = (u: AdminProfile): string | null => {
    if (u.role === 'courier') return courierVerif[u.id]?.verification_status || 'pending';
    if (u.role === 'business') return u.business_verification_status || 'pending';
    return null;
  };

  const isVerified = (u: AdminProfile): boolean => {
    const status = getVerificationStatus(u);
    return status === 'approved' || status === 'verified';
  };

  const isPending = (u: AdminProfile): boolean => {
    if (u.role === 'courier' || u.role === 'business') {
      const status = getVerificationStatus(u);
      return status === 'pending' || status === 'unverified' || status === null;
    }
    return false;
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === 'All' || u.role === ROLE_MAP[roleFilter];
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q
        || (u.full_name || '').toLowerCase().includes(q)
        || (u.first_name || '').toLowerCase().includes(q)
        || (u.email || '').toLowerCase().includes(q)
        || (u.company_name || '').toLowerCase().includes(q);

      let matchesTab = true;
      switch (activeTab) {
        case 'verified':
          matchesTab = isVerified(u);
          break;
        case 'pending':
          matchesTab = isPending(u);
          break;
        case 'retail':
          matchesTab = u.role === 'business' && u.business_type === 'retail';
          break;
        case 'haulage':
          matchesTab = u.role === 'business' && u.business_type === 'haulage';
          break;
      }

      return matchesRole && matchesSearch && matchesTab;
    });
  }, [users, roleFilter, searchQuery, activeTab, courierVerif]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, roleFilter, activeTab]);

  const { getPageItems, totalItems, pageSize } = usePagination(filtered, 25);
  const pageItems = getPageItems(page);

  const tabCounts = useMemo(() => ({
    all: users.length,
    verified: users.filter(isVerified).length,
    pending: users.filter(isPending).length,
    retail: users.filter(u => u.role === 'business' && u.business_type === 'retail').length,
    haulage: users.filter(u => u.role === 'business' && u.business_type === 'haulage').length,
  }), [users, courierVerif]);

  const handleUserUpdated = () => {
    fetchUsers();
    setSelected(null);
  };

  const handleExportCsv = () => {
    exportToCsv(
      'users',
      ['Name', 'Email', 'Role', 'Status', 'Rating', 'Deliveries', 'Joined'],
      filtered.map(u => [
        u.full_name || u.first_name || 'Unnamed',
        u.email || '',
        u.role || '',
        u.verification_status || 'N/A',
        String(u.rating_average ?? ''),
        String(u.completed_deliveries_count ?? ''),
        u.created_at ? new Date(u.created_at).toLocaleDateString() : '',
      ])
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-7 h-7 text-moveme-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} of {users.length} users</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          {canCreateUsers(profile) && (
            <button
              onClick={() => setShowAddStaff(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-moveme-blue-600 text-white rounded-xl text-sm font-medium hover:bg-moveme-blue-700 transition-colors shadow-sm"
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.key;
          const count = tabCounts[tab.key];
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all border ${
                active
                  ? 'bg-moveme-blue-600 text-white border-moveme-blue-600 shadow-sm'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? 'text-white' : 'text-gray-400'}`} />
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-md text-xs font-semibold ${
                active
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, or company..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="relative">
          <button
            onClick={() => setFilterOpen(!filterOpen)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Filter className="w-4 h-4 text-gray-400" />
            {roleFilter === 'All' ? 'Role' : roleFilter}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-elevated border border-gray-200 py-1 z-40">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRoleFilter(r); setFilterOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${roleFilter === r ? 'text-moveme-blue-600 font-medium bg-moveme-blue-50/50' : 'text-gray-700'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">User</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Role</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Status</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Rating</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Deliveries</th>
              <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">Joined</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageItems.map((u) => {
              const vs = getVerificationStatus(u);
              return (
                <tr key={u.id} onClick={() => setSelected(u)} className="hover:bg-gray-50/50 cursor-pointer transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} alt="" className="w-9 h-9 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-moveme-blue-50 flex items-center justify-center flex-shrink-0 text-xs font-bold text-moveme-blue-600">
                          {(u.full_name || u.first_name || '?').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.full_name || u.first_name || 'Unnamed'}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                        {u.role === 'business' && u.company_name && (
                          <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                            <Building2 className="w-3 h-3" />{u.company_name}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-col gap-1">
                      <RoleBadge role={u.role} />
                      {u.role === 'business' && u.business_type && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500 capitalize w-fit">
                          {u.business_type === 'haulage' ? <Truck className="w-2.5 h-2.5" /> : <Store className="w-2.5 h-2.5" />}
                          {u.business_type}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    {vs ? <VerifBadge status={vs} /> : <span className="text-xs text-gray-300">--</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {u.rating_average != null ? (
                      <div className="flex items-center gap-1">
                        <Star className="w-3.5 h-3.5 text-warning-500 fill-warning-500" />
                        <span className="text-sm text-gray-700">{u.rating_average.toFixed(1)}</span>
                      </div>
                    ) : <span className="text-sm text-gray-300">--</span>}
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-700">{u.completed_deliveries_count ?? '--'}</td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '--'}</td>
                  <td className="px-5 py-3.5">
                    <ArrowUpRight className="w-4 h-4 text-gray-300 group-hover:text-moveme-blue-500 transition-colors" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-gray-500">No users match your filters</p>
          </div>
        )}
        <Pagination currentPage={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <div className="md:hidden space-y-3">
        {pageItems.map((u) => {
          const vs = getVerificationStatus(u);
          return (
            <button
              key={u.id}
              onClick={() => setSelected(u)}
              className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left hover:shadow-card transition-all"
            >
              <div className="flex items-center gap-3 mb-2">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-moveme-blue-50 flex items-center justify-center flex-shrink-0 text-sm font-bold text-moveme-blue-600">
                    {(u.full_name || u.first_name || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{u.full_name || u.first_name || 'Unnamed'}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <RoleBadge role={u.role} />
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                {vs && <VerifBadge status={vs} />}
                {u.rating_average != null && (
                  <div className="flex items-center gap-1">
                    <Star className="w-3 h-3 text-warning-500 fill-warning-500" />{u.rating_average.toFixed(1)}
                  </div>
                )}
                {u.completed_deliveries_count != null && <span>{u.completed_deliveries_count} deliveries</span>}
                {u.role === 'business' && u.business_type && (
                  <span className="capitalize flex items-center gap-1">
                    {u.business_type === 'haulage' ? <Truck className="w-3 h-3" /> : <Store className="w-3 h-3" />}
                    {u.business_type}
                  </span>
                )}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-gray-500">No users match your filters</p>
          </div>
        )}
        <Pagination currentPage={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {selected && (
        <AdminUserDrawer
          user={selected}
          onClose={() => setSelected(null)}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {showAddStaff && (
        <AddStaffModal
          onClose={() => setShowAddStaff(false)}
          onCreated={fetchUsers}
        />
      )}
    </div>
  );
}
