import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  DollarSign, TrendingUp, CreditCard, Users, Package, Loader2,
  Search, ArrowUpRight, Calendar, Building2, Download,
} from 'lucide-react';
import { Pagination, usePagination } from './Pagination';
import { exportToCsv } from './adminUtils';

interface CompletedJob {
  id: string;
  job_reference_id: string | null;
  customer_user_id: string;
  total_price: number | null;
  platform_fee: number | null;
  courier_earnings: number | null;
  created_at: string | null;
}

interface Subscription {
  id: string;
  business_user_id: string;
  plan_type: string;
  status: string;
  monthly_amount_ttd: number;
}

interface SubPayment {
  id: string;
  business_user_id: string;
  amount_ttd: number;
  status: string;
  created_at: string | null;
}

interface ProfileMap {
  [id: string]: string;
}

const ttd = (v: number | null | undefined) =>
  v != null
    ? `TT$${Number(v).toLocaleString('en-TT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '--';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-TT', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

const statusColor = (s: string) => {
  if (s === 'active') return 'bg-success-50 text-success-700';
  if (s === 'trialing') return 'bg-moveme-blue-50 text-moveme-blue-700';
  if (s === 'pending') return 'bg-warning-50 text-warning-700';
  return 'bg-gray-100 text-gray-600';
};

export function AdminRevenue() {
  const [jobs, setJobs] = useState<CompletedJob[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [subPayments, setSubPayments] = useState<SubPayment[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      try {
        const [jobRes, subRes, payRes] = await Promise.all([
          supabase
            .from('jobs')
            .select('id, job_reference_id, customer_user_id, total_price, platform_fee, courier_earnings, created_at')
            .eq('status', 'completed')
            .order('created_at', { ascending: false }),
          supabase
            .from('business_subscriptions')
            .select('id, business_user_id, plan_type, status, monthly_amount_ttd'),
          supabase
            .from('subscription_payments')
            .select('id, business_user_id, amount_ttd, status, created_at')
            .order('created_at', { ascending: false })
            .limit(50),
        ]);

        const completedJobs = (jobRes.data || []) as CompletedJob[];
        const subscriptions = (subRes.data || []) as Subscription[];
        const payments = (payRes.data || []) as SubPayment[];

        const userIds = new Set<string>();
        completedJobs.forEach((j) => userIds.add(j.customer_user_id));
        subscriptions.forEach((s) => userIds.add(s.business_user_id));
        payments.forEach((p) => userIds.add(p.business_user_id));

        const profileMap: ProfileMap = {};
        if (userIds.size > 0) {
          const { data: pData } = await supabase
            .from('profiles')
            .select('id, full_name, first_name, last_name, company_name')
            .in('id', Array.from(userIds));
          (pData || []).forEach((p: { id: string; full_name: string | null; first_name: string | null; last_name: string | null; company_name: string | null }) => {
            profileMap[p.id] = p.company_name || p.full_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown';
          });
        }

        setJobs(completedJobs);
        setSubs(subscriptions);
        setSubPayments(payments);
        setProfiles(profileMap);
      } catch (err) {
        console.error('Revenue fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-moveme-blue-600 animate-spin" />
      </div>
    );
  }

  const totalRevenue = jobs.reduce((s, j) => s + (j.platform_fee || 0), 0);
  const totalJobValue = jobs.reduce((s, j) => s + (j.total_price || 0), 0);
  const courierPayouts = jobs.reduce((s, j) => s + (j.courier_earnings || 0), 0);
  const avgJobValue = jobs.length > 0 ? totalJobValue / jobs.length : 0;
  const activeSubs = subs.filter((s) => s.status === 'active' || s.status === 'trialing');
  const subRevenue = activeSubs.reduce((s, sub) => s + Number(sub.monthly_amount_ttd), 0);
  const pendingPayments = subPayments.filter((p) => p.status === 'pending').length;

  const filtered = search.trim()
    ? jobs.filter((j) => (j.job_reference_id || '').toLowerCase().includes(search.toLowerCase()))
    : jobs;

  const { getPageItems, totalItems, pageSize } = usePagination(filtered, 25);
  const pageItems = getPageItems(page);

  const handleExportCsv = () => {
    exportToCsv(
      'revenue',
      ['Reference', 'Customer', 'Total Price', 'Platform Fee', 'Courier Earnings', 'Date'],
      filtered.map((j) => [
        j.job_reference_id || j.id.slice(0, 8),
        profiles[j.customer_user_id] || 'Unknown',
        j.total_price,
        j.platform_fee,
        j.courier_earnings,
        j.created_at,
      ])
    );
  };

  const cards = [
    { label: 'Total Revenue', value: ttd(totalRevenue), icon: DollarSign, bg: 'bg-success-50', color: 'text-success-600' },
    { label: 'Total Job Value', value: ttd(totalJobValue), icon: TrendingUp, bg: 'bg-moveme-blue-50', color: 'text-moveme-blue-600' },
    { label: 'Courier Payouts', value: ttd(courierPayouts), icon: Users, bg: 'bg-error-50', color: 'text-error-600' },
    { label: 'Avg Job Value', value: ttd(avgJobValue), icon: Package, bg: 'bg-moveme-blue-50', color: 'text-moveme-blue-600' },
    { label: 'Subscription Revenue', value: ttd(subRevenue), icon: CreditCard, bg: 'bg-success-50', color: 'text-success-600' },
    { label: 'Pending Payments', value: String(pendingPayments), icon: ArrowUpRight, bg: 'bg-warning-50', color: 'text-warning-600' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Revenue & Payments</h1>
        <p className="text-sm text-gray-500 mt-1">Financial overview for MoveMe TT</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-card transition-shadow">
            <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
              <c.icon className={`w-5 h-5 ${c.color}`} />
            </div>
            <p className="text-xs font-medium text-gray-500 mb-1">{c.label}</p>
            <p className="text-xl font-bold text-gray-900">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-success-600" />
            <h2 className="text-base font-semibold text-gray-900">Completed Jobs Revenue</h2>
            <span className="text-xs text-gray-400">{filtered.length} jobs</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download CSV
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by Job Ref ID"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent w-full sm:w-64"
              />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
                <th className="pb-3 pr-4">Reference</th>
                <th className="pb-3 pr-4">Customer</th>
                <th className="pb-3 pr-4 text-right">Total Price</th>
                <th className="pb-3 pr-4 text-right">Platform Fee</th>
                <th className="pb-3 pr-4 text-right">Courier Earnings</th>
                <th className="pb-3 text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-400">No completed jobs found</td>
                </tr>
              ) : (
                pageItems.map((j) => (
                  <tr key={j.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="py-3 pr-4 font-medium text-moveme-blue-600">{j.job_reference_id || j.id.slice(0, 8)}</td>
                    <td className="py-3 pr-4 text-gray-700">{profiles[j.customer_user_id] || 'Unknown'}</td>
                    <td className="py-3 pr-4 text-right font-medium text-gray-900">{ttd(j.total_price)}</td>
                    <td className="py-3 pr-4 text-right font-medium text-success-600">{ttd(j.platform_fee)}</td>
                    <td className="py-3 pr-4 text-right font-medium text-error-600">{ttd(j.courier_earnings)}</td>
                    <td className="py-3 text-right text-gray-500">{fmtDate(j.created_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Building2 className="w-5 h-5 text-moveme-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Business Subscriptions</h2>
            <span className="text-xs text-gray-400">{subs.length} total</span>
          </div>
          {subs.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No subscriptions</p>
          ) : (
            <div className="space-y-2">
              {subs.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{profiles[s.business_user_id] || 'Unknown Business'}</p>
                    <p className="text-xs text-gray-500 capitalize">{s.plan_type}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-900">{ttd(s.monthly_amount_ttd)}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(s.status)}`}>
                      {s.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-moveme-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Recent Subscription Payments</h2>
          </div>
          {subPayments.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No subscription payments</p>
          ) : (
            <div className="space-y-2">
              {subPayments.map((p) => (
                <div key={p.id} className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{profiles[p.business_user_id] || 'Unknown Business'}</p>
                    <p className="text-xs text-gray-500">{fmtDate(p.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-gray-900">{ttd(p.amount_ttd)}</span>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColor(p.status)}`}>
                      {p.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
