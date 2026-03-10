import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search, Filter, ChevronDown, ArrowUpRight, Star, Truck,
  Users, Shield, Loader2, Building2, Download, RefreshCw,
} from 'lucide-react';
import { AdminCompanyDrawer } from './AdminCompanyDrawer';
import { exportToCsv, formatDateShort } from './adminUtils';
import { Pagination, usePagination } from './Pagination';

interface Company {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  company_name: string | null;
  company_email: string | null;
  company_address: string | null;
  business_type: string | null;
  business_verification_status: string | null;
  business_verified: boolean | null;
  business_verified_at: string | null;
  created_at: string | null;
  haulage_business_registration: string | null;
  haulage_years_in_operation: number | null;
  haulage_insurance_status: string | null;
  haulage_operating_regions: string[] | null;
  haulage_cargo_specialties: string[] | null;
  haulage_equipment_types: string[] | null;
  haulage_service_hours: string | null;
  haulage_emergency_contact: string | null;
  haulage_dispatch_phone: string | null;
  haulage_tax_id: string | null;
  haulage_safety_rating: string | null;
  haulage_onboarding_completed: boolean | null;
  rating_average: number | null;
  completed_deliveries_count: number | null;
  driver_count?: number;
  vehicle_count?: number;
}

const TYPE_OPTIONS = ['All', 'Haulage', 'Retail'];
const VERIFICATION_OPTIONS = ['All', 'Verified', 'Pending', 'Rejected'];
const TYPE_COLORS: Record<string, string> = { haulage: 'bg-moveme-blue-50 text-moveme-blue-700', retail: 'bg-warning-50 text-warning-700' };
const STATUS_COLORS: Record<string, string> = { approved: 'bg-success-50 text-success-700', pending: 'bg-warning-50 text-warning-700', rejected: 'bg-error-50 text-error-700' };
const STATUS_MAP: Record<string, string> = { Verified: 'approved', Pending: 'pending', Rejected: 'rejected' };

export function AdminCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeOpen, setTypeOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [page, setPage] = useState(1);

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, phone, company_name, company_email, company_address, business_type, business_verification_status, business_verified, business_verified_at, created_at, haulage_business_registration, haulage_years_in_operation, haulage_insurance_status, haulage_operating_regions, haulage_cargo_specialties, haulage_equipment_types, haulage_service_hours, haulage_emergency_contact, haulage_dispatch_phone, haulage_tax_id, haulage_safety_rating, haulage_onboarding_completed, rating_average, completed_deliveries_count')
        .eq('role', 'business')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const profiles = (data || []) as Company[];
      const haulageIds = profiles.filter((p) => p.business_type === 'haulage').map((p) => p.id);
      let driverCounts: Record<string, number> = {};
      let vehicleCounts: Record<string, number> = {};
      if (haulageIds.length > 0) {
        const [{ data: drivers }, { data: vehicles }] = await Promise.all([
          supabase.from('haulage_drivers').select('company_id').in('company_id', haulageIds),
          supabase.from('haulage_vehicles').select('company_id').in('company_id', haulageIds),
        ]);
        (drivers || []).forEach((d: { company_id: string }) => { driverCounts[d.company_id] = (driverCounts[d.company_id] || 0) + 1; });
        (vehicles || []).forEach((v: { company_id: string }) => { vehicleCounts[v.company_id] = (vehicleCounts[v.company_id] || 0) + 1; });
      }
      setCompanies(profiles.map((p) => ({ ...p, driver_count: driverCounts[p.id] || 0, vehicle_count: vehicleCounts[p.id] || 0 })));
    } catch (err) {
      console.error('Error fetching companies:', err);
    } finally { setLoading(false); }
  };

  useEffect(() => {
    fetchCompanies();
    const channel = supabase
      .channel('admin-companies-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => { fetchCompanies(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleVerify = async (id: string, action: 'approve' | 'reject') => {
    const isApprove = action === 'approve';
    const { error } = await supabase.from('profiles').update({
      business_verification_status: isApprove ? 'approved' : 'rejected',
      business_verified: isApprove,
      business_verified_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) { console.error('Verification error:', error); return; }
    setSelected(null);
    fetchCompanies();
  };

  const filtered = companies.filter((c) => {
    const matchesType = typeFilter === 'All' || c.business_type === typeFilter.toLowerCase();
    const matchesStatus = statusFilter === 'All' || (c.business_verification_status || 'pending') === STATUS_MAP[statusFilter];
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q || (c.company_name || '').toLowerCase().includes(q) || (c.company_email || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q);
    return matchesType && matchesStatus && matchesSearch;
  });

  const { getPageItems, totalItems, pageSize } = usePagination(filtered, 25);
  const pageItems = getPageItems(page);

  const handleExportCsv = () => {
    exportToCsv('companies', ['Company Name', 'Email', 'Type', 'Status', 'Rating', 'Deliveries', 'Drivers', 'Vehicles', 'Joined'], filtered.map((c) => [
      c.company_name || c.full_name || 'Unnamed',
      c.company_email || c.email || '',
      c.business_type || '',
      c.business_verification_status || 'pending',
      c.rating_average != null ? Number(c.rating_average).toFixed(1) : '',
      String(c.completed_deliveries_count ?? ''),
      String(c.driver_count ?? ''),
      String(c.vehicle_count ?? ''),
      formatDateShort(c.created_at),
    ]));
  };

  if (loading) return <div className="flex items-center justify-center py-24"><Loader2 className="w-7 h-7 text-moveme-blue-600 animate-spin" /></div>;

  const typeBadge = (t: string | null) => <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[t || ''] || 'bg-gray-100 text-gray-600'}`}>{(t || 'unknown').charAt(0).toUpperCase() + (t || 'unknown').slice(1)}</span>;
  const statusBadge = (s: string | null) => { const v = s || 'pending'; return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v] || STATUS_COLORS.pending}`}>{v === 'approved' && <Shield className="w-3 h-3" />}{v.charAt(0).toUpperCase() + v.slice(1)}</span>; };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-end justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Companies</h1><p className="text-sm text-gray-500 mt-1">{filtered.length} of {companies.length} businesses</p></div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            <Download className="w-4 h-4" />Export
          </button>
          <button onClick={fetchCompanies} className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors">
            <RefreshCw className="w-4 h-4" />Refresh
          </button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Search by company name or email..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }} className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all" />
        </div>
        <div className="relative">
          <button onClick={() => { setTypeOpen(!typeOpen); setStatusOpen(false); }} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Filter className="w-4 h-4 text-gray-400" />{typeFilter === 'All' ? 'Type' : typeFilter}<ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {typeOpen && (<><div className="fixed inset-0 z-30" onClick={() => setTypeOpen(false)} /><div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-elevated border border-gray-200 py-1 z-40">
            {TYPE_OPTIONS.map((t) => (<button key={t} onClick={() => { setTypeFilter(t); setTypeOpen(false); setPage(1); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${typeFilter === t ? 'text-moveme-blue-600 font-medium bg-moveme-blue-50/50' : 'text-gray-700'}`}>{t}</button>))}
          </div></>)}
        </div>
        <div className="relative">
          <button onClick={() => { setStatusOpen(!statusOpen); setTypeOpen(false); }} className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            <Shield className="w-4 h-4 text-gray-400" />{statusFilter === 'All' ? 'Status' : statusFilter}<ChevronDown className="w-4 h-4 text-gray-400" />
          </button>
          {statusOpen && (<><div className="fixed inset-0 z-30" onClick={() => setStatusOpen(false)} /><div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl shadow-elevated border border-gray-200 py-1 z-40">
            {VERIFICATION_OPTIONS.map((v) => (<button key={v} onClick={() => { setStatusFilter(v); setStatusOpen(false); setPage(1); }} className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors ${statusFilter === v ? 'text-moveme-blue-600 font-medium bg-moveme-blue-50/50' : 'text-gray-700'}`}>{v}</button>))}
          </div></>)}
        </div>
      </div>
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-gray-50/80 border-b border-gray-100">
            {['Company', 'Type', 'Rating', 'Deliveries', 'Drivers', 'Vehicles', 'Status'].map((h) => <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">{h}</th>)}
            <th className="px-5 py-3" />
          </tr></thead>
          <tbody className="divide-y divide-gray-50">
            {pageItems.map((c) => (
              <tr key={c.id} onClick={() => setSelected(c)} className="hover:bg-gray-50/50 cursor-pointer transition-colors">
                <td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${c.business_type === 'haulage' ? 'bg-moveme-blue-50' : 'bg-warning-50'}`}>{c.business_type === 'haulage' ? <Truck className="w-4 h-4 text-moveme-blue-600" /> : <Building2 className="w-4 h-4 text-warning-600" />}</div><div><p className="text-sm font-medium text-gray-900">{c.company_name || c.full_name || 'Unnamed'}</p><p className="text-xs text-gray-400">{c.company_email || c.email}</p></div></div></td>
                <td className="px-5 py-3.5">{typeBadge(c.business_type)}</td>
                <td className="px-5 py-3.5">{c.rating_average != null ? <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-warning-500 fill-warning-500" /><span className="text-sm text-gray-700">{Number(c.rating_average).toFixed(1)}</span></div> : <span className="text-sm text-gray-300">--</span>}</td>
                <td className="px-5 py-3.5 text-sm text-gray-700">{c.completed_deliveries_count ?? '--'}</td>
                <td className="px-5 py-3.5 text-sm text-gray-700">{c.business_type === 'haulage' ? c.driver_count : '--'}</td>
                <td className="px-5 py-3.5 text-sm text-gray-700">{c.business_type === 'haulage' ? c.vehicle_count : '--'}</td>
                <td className="px-5 py-3.5">{statusBadge(c.business_verification_status)}</td>
                <td className="px-5 py-3.5"><ArrowUpRight className="w-4 h-4 text-gray-300" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {pageItems.length === 0 && <div className="px-5 py-12 text-center"><p className="text-sm text-gray-500">No companies match your filters</p></div>}
        <Pagination currentPage={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>
      <div className="md:hidden space-y-3">
        {pageItems.map((c) => (
          <button key={c.id} onClick={() => setSelected(c)} className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left hover:shadow-card transition-all">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${c.business_type === 'haulage' ? 'bg-moveme-blue-50' : 'bg-warning-50'}`}>{c.business_type === 'haulage' ? <Truck className="w-5 h-5 text-moveme-blue-600" /> : <Building2 className="w-5 h-5 text-warning-600" />}</div>
              <div className="flex-1 min-w-0"><p className="text-sm font-semibold text-gray-900 truncate">{c.company_name || c.full_name || 'Unnamed'}</p><p className="text-xs text-gray-400 truncate">{c.company_email || c.email}</p></div>
              {typeBadge(c.business_type)}
            </div>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              {c.rating_average != null && <div className="flex items-center gap-1"><Star className="w-3 h-3 text-warning-500 fill-warning-500" />{Number(c.rating_average).toFixed(1)}</div>}
              <span>{c.completed_deliveries_count ?? 0} deliveries</span>
              {c.business_type === 'haulage' && c.driver_count! > 0 && <span>{c.driver_count} drivers</span>}
              {statusBadge(c.business_verification_status)}
            </div>
          </button>
        ))}
        {pageItems.length === 0 && <div className="py-12 text-center"><p className="text-sm text-gray-500">No companies match your filters</p></div>}
        <Pagination currentPage={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>
      {selected && <AdminCompanyDrawer company={selected} onClose={() => setSelected(null)} onVerify={handleVerify} onRefresh={fetchCompanies} />}
    </div>
  );
}
