import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ClipboardList, Search, Filter, ChevronDown, Loader2, User, Settings, Building2, CreditCard, KeyRound, Shield, RefreshCw } from 'lucide-react';
import { timeAgo, formatDateShort } from './adminUtils';
import { Pagination, usePagination } from './Pagination';

interface AuditEntry {
  id: string;
  admin_user_id: string;
  action: string;
  target_type: string;
  target_id: string;
  details: Record<string, unknown>;
  created_at: string | null;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: typeof User }> = {
  change_role: { label: 'Role Change', color: 'bg-moveme-blue-50 text-moveme-blue-700', icon: Shield },
  approve_courier: { label: 'Courier Approved', color: 'bg-success-50 text-success-700', icon: User },
  reject_courier: { label: 'Courier Rejected', color: 'bg-error-50 text-error-700', icon: User },
  approve_business: { label: 'Business Approved', color: 'bg-success-50 text-success-700', icon: Building2 },
  reject_business: { label: 'Business Rejected', color: 'bg-error-50 text-error-700', icon: Building2 },
  reset_password: { label: 'Password Reset', color: 'bg-warning-50 text-warning-700', icon: KeyRound },
  update_setting: { label: 'Setting Updated', color: 'bg-gray-100 text-gray-700', icon: Settings },
  update_fees: { label: 'Fees Updated', color: 'bg-success-50 text-success-700', icon: CreditCard },
  verify_bank: { label: 'Bank Verified', color: 'bg-success-50 text-success-700', icon: CreditCard },
  confirm_payment: { label: 'Payment Confirmed', color: 'bg-success-50 text-success-700', icon: CreditCard },
  suspend_subscription: { label: 'Subscription Suspended', color: 'bg-error-50 text-error-700', icon: CreditCard },
  reactivate_subscription: { label: 'Subscription Reactivated', color: 'bg-success-50 text-success-700', icon: CreditCard },
};

const TARGET_FILTERS = ['All', 'user', 'company', 'subscription', 'settings'];

export function AdminAuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [adminNames, setAdminNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [targetFilter, setTargetFilter] = useState('All');
  const [filterOpen, setFilterOpen] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => { fetchAuditLog(); }, []);

  const fetchAuditLog = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      const rows = (data || []) as AuditEntry[];
      setEntries(rows);

      const adminIds = [...new Set(rows.map((e) => e.admin_user_id))];
      if (adminIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, email')
          .in('id', adminIds);
        const map: Record<string, string> = {};
        (profiles || []).forEach((p: any) => {
          map[p.id] = p.full_name || p.first_name || p.email || 'Admin';
        });
        setAdminNames(map);
      }
    } catch (err) {
      console.error('Failed to fetch audit log:', err);
    } finally { setLoading(false); }
  };

  const filtered = entries.filter((e) => {
    if (targetFilter !== 'All' && e.target_type !== targetFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return e.action.toLowerCase().includes(q) ||
      e.target_type.toLowerCase().includes(q) ||
      e.target_id.toLowerCase().includes(q) ||
      (adminNames[e.admin_user_id] || '').toLowerCase().includes(q);
  });

  const { getPageItems, totalItems, pageSize } = usePagination(filtered, 30);
  const pageItems = getPageItems(page);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 text-moveme-blue-600 animate-spin" /></div>;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>
          <p className="text-sm text-gray-500 mt-1">Track all admin actions on the platform</p>
        </div>
        <button onClick={fetchAuditLog} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
          <RefreshCw className="w-4 h-4" />Refresh
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by action, admin, or target..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="relative">
          <button onClick={() => setFilterOpen(!filterOpen)} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4 text-gray-400" />
            {targetFilter === 'All' ? 'All Types' : targetFilter}
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {filterOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setFilterOpen(false)} />
              <div className="absolute right-0 top-full mt-1 w-44 bg-white rounded-xl shadow-elevated border border-gray-200 py-1 z-40">
                {TARGET_FILTERS.map((t) => (
                  <button key={t} onClick={() => { setTargetFilter(t); setFilterOpen(false); setPage(1); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors capitalize ${targetFilter === t ? 'text-moveme-blue-600 font-medium bg-moveme-blue-50/50' : 'text-gray-700'}`}
                  >{t === 'All' ? 'All Types' : t}</button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {pageItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <ClipboardList className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500 font-medium">No audit entries found</p>
            <p className="text-xs text-gray-400 mt-1">Admin actions will appear here as they occur</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pageItems.map((entry) => {
              const config = ACTION_CONFIG[entry.action] || { label: entry.action, color: 'bg-gray-100 text-gray-600', icon: ClipboardList };
              const ActionIcon = config.icon;
              return (
                <div key={entry.id} className="flex items-start gap-3 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${config.color.split(' ')[0]}`}>
                    <ActionIcon className={`w-4 h-4 ${config.color.split(' ')[1]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>{config.label}</span>
                      <span className="text-xs text-gray-400">by {adminNames[entry.admin_user_id] || 'Admin'}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span className="font-medium capitalize">{entry.target_type}</span>
                      {entry.target_id && <span className="font-mono text-gray-400">{entry.target_id.length > 20 ? entry.target_id.slice(0, 8) + '...' : entry.target_id}</span>}
                    </div>
                    {entry.details && Object.keys(entry.details).length > 0 && (
                      <div className="mt-1.5 text-xs text-gray-400 bg-gray-50 rounded-lg px-2.5 py-1.5 inline-block">
                        {Object.entries(entry.details).map(([k, v]) => (
                          <span key={k} className="mr-3"><span className="font-medium text-gray-500">{k}:</span> {String(v)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{timeAgo(entry.created_at)}</p>
                    <p className="text-[11px] text-gray-300 mt-0.5">{formatDateShort(entry.created_at)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <Pagination currentPage={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>
    </div>
  );
}
