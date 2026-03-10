import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Search, X, ArrowUpRight, MapPin,
  DollarSign, Calendar, Package, Loader2, Truck, Building2,
  Hash, Copy, CheckCircle2, Download,
} from 'lucide-react';
import { AdminJobTracker } from './AdminJobTracker';
import { Pagination, usePagination } from './Pagination';
import { exportToCsv } from './adminUtils';

interface Job {
  id: string;
  job_reference_id: string | null;
  customer_user_id: string;
  assigned_courier_id: string | null;
  status: string | null;
  pickup_location_text: string;
  dropoff_location_text: string;
  cargo_category: string | null;
  customer_offer_ttd: number | null;
  total_price: number | null;
  platform_fee: number | null;
  courier_earnings: number | null;
  created_at: string | null;
  delivery_type: string | null;
  is_multi_stop: boolean | null;
  assigned_company_name: string | null;
  assigned_driver_name: string | null;
}

type TabKey = 'all' | 'open' | 'assigned' | 'completed' | 'cancelled';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const TAB_STATUSES: Record<TabKey, string[]> = {
  all: [],
  open: ['draft', 'open', 'bidding'],
  assigned: ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'in_progress', 'delivered', 'returning'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-warning-50 text-warning-700',
  draft: 'bg-warning-50 text-warning-700',
  bidding: 'bg-warning-50 text-warning-700',
  assigned: 'bg-moveme-blue-50 text-moveme-blue-700',
  on_way_to_pickup: 'bg-moveme-blue-50 text-moveme-blue-700',
  cargo_collected: 'bg-moveme-teal-50 text-moveme-teal-700',
  in_transit: 'bg-moveme-teal-50 text-moveme-teal-700',
  in_progress: 'bg-moveme-teal-50 text-moveme-teal-700',
  delivered: 'bg-success-50 text-success-700',
  returning: 'bg-error-50 text-error-700',
  completed: 'bg-success-50 text-success-700',
  cancelled: 'bg-error-50 text-error-700',
};

const TAB_DOT_COLORS: Record<TabKey, string> = {
  all: 'bg-gray-400',
  open: 'bg-warning-500',
  assigned: 'bg-moveme-blue-500',
  completed: 'bg-success-500',
  cancelled: 'bg-error-500',
};

function statusBadge(status: string | null) {
  const s = status || 'open';
  const label = s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[s] || STATUS_COLORS.open}`}>
      {label}
    </span>
  );
}

function ttd(val: number | null | undefined) {
  return val != null ? `TT$${Number(val).toLocaleString('en-TT', { minimumFractionDigits: 2 })}` : '--';
}

function JobRefBadge({ refId, id }: { refId: string | null; id: string }) {
  const [copied, setCopied] = useState(false);
  const display = refId || id.slice(0, 8).toUpperCase();

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(refId || id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors group"
      title="Copy Job Reference"
    >
      <Hash className="w-3 h-3 text-gray-400" />
      <span className="text-sm font-bold text-gray-800 tracking-wide">{display}</span>
      {copied ? (
        <CheckCircle2 className="w-3 h-3 text-success-600" />
      ) : (
        <Copy className="w-3 h-3 text-gray-300 group-hover:text-gray-500 transition-colors" />
      )}
    </button>
  );
}

function JobDrawer({ job, customerName, courierName, onClose }: {
  job: Job; customerName: string; courierName: string; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-elevated animate-slide-up sm:animate-fade-in overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="space-y-2">
            <JobRefBadge refId={job.job_reference_id} id={job.id} />
            <div>{statusBadge(job.status)}</div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-5">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-moveme-blue-50 flex items-center justify-center mt-0.5">
                <MapPin className="w-4 h-4 text-moveme-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Pickup</p>
                <p className="text-sm font-medium text-gray-900">{job.pickup_location_text}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-success-50 flex items-center justify-center mt-0.5">
                <MapPin className="w-4 h-4 text-success-600" />
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Dropoff</p>
                <p className="text-sm font-medium text-gray-900">{job.dropoff_location_text}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pricing Breakdown</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Customer Offer</span><span className="font-medium text-gray-900">{ttd(job.customer_offer_ttd)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Platform Fee</span><span className="font-medium text-gray-900">{ttd(job.platform_fee)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Courier Earnings</span><span className="font-medium text-gray-900">{ttd(job.courier_earnings)}</span></div>
              <div className="border-t border-gray-200 pt-2 flex justify-between"><span className="font-semibold text-gray-700">Total</span><span className="font-bold text-gray-900">{ttd(job.total_price)}</span></div>
            </div>
          </div>
          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Parties</h3>
            <div><p className="text-xs text-gray-400">Customer</p><p className="text-sm font-medium text-gray-900">{customerName}</p></div>
            <div><p className="text-xs text-gray-400">Courier</p><p className="text-sm font-medium text-gray-900">{courierName}</p></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1"><Package className="w-3.5 h-3.5 text-gray-400" /><p className="text-xs text-gray-400 font-medium">Cargo</p></div>
              <p className="text-sm font-semibold text-gray-900 capitalize">{job.cargo_category || '--'}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 mb-1"><Truck className="w-3.5 h-3.5 text-gray-400" /><p className="text-xs text-gray-400 font-medium">Delivery</p></div>
              <p className="text-sm font-semibold text-gray-900 capitalize">{job.delivery_type || 'asap'}{job.is_multi_stop ? ' (Multi)' : ''}</p>
            </div>
          </div>
          {(job.assigned_company_name || job.assigned_driver_name) && (
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Assignment</h3>
              {job.assigned_company_name && (
                <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-900">{job.assigned_company_name}</span></div>
              )}
              {job.assigned_driver_name && (
                <div className="flex items-center gap-2"><Truck className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-900">{job.assigned_driver_name}</span></div>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>Created {job.created_at ? new Date(job.created_at).toLocaleString() : '--'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [courierUserMap, setCourierUserMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [selected, setSelected] = useState<Job | null>(null);
  const [trackingJobId, setTrackingJobId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => { fetchJobs(); }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-jobs-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
        fetchJobs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchJobs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('jobs')
        .select('id, job_reference_id, customer_user_id, assigned_courier_id, status, pickup_location_text, dropoff_location_text, cargo_category, customer_offer_ttd, total_price, platform_fee, courier_earnings, created_at, delivery_type, is_multi_stop, assigned_company_name, assigned_driver_name')
        .order('created_at', { ascending: false });
      if (error) throw error;
      const rows = (data || []) as Job[];
      setJobs(rows);

      const customerIds = [...new Set(rows.map((j) => j.customer_user_id))];
      const courierIds = [...new Set(rows.map((j) => j.assigned_courier_id).filter(Boolean))] as string[];

      let cuMap: Record<string, string> = {};
      if (courierIds.length > 0) {
        const { data: cData } = await supabase.from('couriers').select('id, user_id').in('id', courierIds);
        (cData || []).forEach((c: any) => { cuMap[c.id] = c.user_id; });
        setCourierUserMap(cuMap);
      }

      const profileIds = [...new Set([...customerIds, ...Object.values(cuMap)])];
      if (profileIds.length > 0) {
        const { data: pData } = await supabase.from('profiles').select('id, full_name').in('id', profileIds);
        const map: Record<string, string> = {};
        (pData || []).forEach((p: any) => { map[p.id] = p.full_name || 'Unnamed'; });
        setNames(map);
      }
    } catch (err) {
      console.error('Error fetching jobs:', err);
    } finally { setLoading(false); }
  };

  const customerName = (j: Job) => names[j.customer_user_id] || 'Unknown';
  const courierName = (j: Job) => {
    if (!j.assigned_courier_id) return 'Unassigned';
    const uid = courierUserMap[j.assigned_courier_id];
    return uid ? (names[uid] || 'Unknown') : 'Unknown';
  };

  const TRACKABLE_STATUSES = ['assigned', 'on_way_to_pickup', 'arrived_waiting', 'loading_cargo', 'cargo_collected', 'in_transit', 'in_progress', 'delivered', 'returning', 'completed', 'cancelled'];
  const handleJobClick = (j: Job) => {
    if (TRACKABLE_STATUSES.includes(j.status || '')) {
      setTrackingJobId(j.id);
    } else {
      setSelected(j);
    }
  };

  const tabCount = (key: TabKey) => {
    if (key === 'all') return jobs.length;
    return jobs.filter((j) => TAB_STATUSES[key].includes(j.status || 'open')).length;
  };

  const filtered = jobs.filter((j) => {
    const matchesTab = activeTab === 'all' || TAB_STATUSES[activeTab].includes(j.status || 'open');
    const q = searchQuery.toLowerCase();
    if (!q) return matchesTab;
    const cn = customerName(j).toLowerCase();
    const crn = courierName(j).toLowerCase();
    return matchesTab && (
      (j.job_reference_id || '').toLowerCase().includes(q)
      || j.id.toLowerCase().includes(q)
      || j.pickup_location_text.toLowerCase().includes(q)
      || j.dropoff_location_text.toLowerCase().includes(q)
      || cn.includes(q) || crn.includes(q)
    );
  });

  const { getPageItems, totalItems, pageSize } = usePagination(filtered, 25);
  const pageItems = getPageItems(page);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1);
  };

  const handleDownloadCsv = () => {
    const headers = ['Job ID', 'Customer', 'Courier', 'Pickup', 'Dropoff', 'Status', 'Price', 'Date'];
    const rows = filtered.map((j) => [
      j.job_reference_id || j.id,
      customerName(j),
      courierName(j),
      j.pickup_location_text,
      j.dropoff_location_text,
      (j.status || 'open').replace(/_/g, ' '),
      j.total_price != null ? String(j.total_price) : j.customer_offer_ttd != null ? String(j.customer_offer_ttd) : '',
      j.created_at ? new Date(j.created_at).toLocaleDateString() : '',
    ]);
    exportToCsv('jobs', headers, rows);
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
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} of {jobs.length} jobs</p>
        </div>
        <button
          onClick={handleDownloadCsv}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors"
        >
          <Download className="w-4 h-4" />
          Download CSV
        </button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-1 bg-white rounded-2xl border border-gray-100 p-1.5 overflow-x-auto">
          {TABS.map((tab) => {
            const count = tabCount(tab.key);
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => handleTabChange(tab.key)}
                className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                  active
                    ? 'bg-gray-900 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    active ? 'bg-white/80' : TAB_DOT_COLORS[tab.key]
                  }`}
                />
                {tab.label}
                <span
                  className={`ml-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by Job ID, location, customer, or courier..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
          />
        </div>
      </div>

      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              {['Job ID', 'Customer', 'Courier', 'Route', 'Status', 'Price', 'Date'].map((h) => (
                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-5 py-3">{h}</th>
              ))}
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pageItems.map((j) => (
              <tr key={j.id} onClick={() => handleJobClick(j)} className="hover:bg-gray-50/50 cursor-pointer transition-colors">
                <td className="px-5 py-3.5">
                  <JobRefBadge refId={j.job_reference_id} id={j.id} />
                </td>
                <td className="px-5 py-3.5 text-sm text-gray-700">{customerName(j)}</td>
                <td className="px-5 py-3.5 text-sm text-gray-700">{courierName(j)}</td>
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 max-w-[220px]">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <span className="truncate">{j.pickup_location_text} → {j.dropoff_location_text}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5">{statusBadge(j.status)}</td>
                <td className="px-5 py-3.5 text-sm font-medium text-gray-900">{ttd(j.total_price ?? j.customer_offer_ttd)}</td>
                <td className="px-5 py-3.5 text-sm text-gray-500">{j.created_at ? new Date(j.created_at).toLocaleDateString() : '--'}</td>
                <td className="px-5 py-3.5"><ArrowUpRight className="w-4 h-4 text-gray-300" /></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-5 py-12 text-center">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No jobs match your search</p>
          </div>
        )}
        <Pagination currentPage={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <div className="md:hidden space-y-3">
        {pageItems.map((j) => (
          <button
            key={j.id}
            onClick={() => handleJobClick(j)}
            className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left hover:shadow-card transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <JobRefBadge refId={j.job_reference_id} id={j.id} />
              {statusBadge(j.status)}
            </div>
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                <span className="truncate">{j.pickup_location_text} → {j.dropoff_location_text}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">{customerName(j)}</span>
                <span className="font-semibold text-gray-900">{ttd(j.total_price ?? j.customer_offer_ttd)}</span>
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="py-12 text-center">
            <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No jobs match your search</p>
          </div>
        )}
        <Pagination currentPage={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {selected && (
        <JobDrawer
          job={selected}
          customerName={customerName(selected)}
          courierName={courierName(selected)}
          onClose={() => setSelected(null)}
        />
      )}

      {trackingJobId && (
        <AdminJobTracker
          jobId={trackingJobId}
          onClose={() => setTrackingJobId(null)}
        />
      )}
    </div>
  );
}
