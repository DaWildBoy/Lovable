import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  FileText,
  Loader2,
  Search,
  Download,
  Eye,
  Send,
  Filter,
  ChevronDown,
  X,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { InvoicePDFViewer } from './InvoicePDFViewer';
import { Pagination, usePagination } from './Pagination';
import { exportToCsv } from './adminUtils';

interface Invoice {
  id: string;
  invoice_number: string;
  job_id: string;
  customer_user_id: string;
  courier_user_id: string | null;
  customer_name: string;
  customer_email: string;
  courier_name: string;
  job_reference_id: string;
  pickup_location: string;
  dropoff_location: string;
  delivery_type: string;
  base_price: number;
  platform_fee: number;
  vat_amount: number;
  total_price: number;
  courier_earnings: number;
  status: string;
  sent_at: string | null;
  paid_at: string | null;
  pdf_url: string | null;
  email_sent: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

const ttd = (v: number | null | undefined) =>
  v != null
    ? `TT$${Number(v).toLocaleString('en-TT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '--';

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString('en-TT', { day: '2-digit', month: 'short', year: 'numeric' }) : '--';

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  sent: { bg: 'bg-moveme-blue-50', text: 'text-moveme-blue-700', label: 'Sent' },
  paid: { bg: 'bg-success-50', text: 'text-success-700', label: 'Paid' },
  overdue: { bg: 'bg-error-50', text: 'text-error-700', label: 'Overdue' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
};

const STATUS_FILTERS = ['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'];

export function AdminInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [sendingEmail, setSendingEmail] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices((data || []) as Invoice[]);
    } catch (err) {
      console.error('Failed to fetch invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async (invoice: Invoice) => {
    setSendingEmail(invoice.id);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice`;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice_id: invoice.id, action: 'send_email' }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to send invoice email');
      }

      setToast({ type: 'success', message: `Invoice emailed to ${invoice.customer_email}` });
      fetchInvoices();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to send email';
      setToast({ type: 'error', message });
    } finally {
      setSendingEmail(null);
    }
  };

  const handleMarkPaid = async (invoice: Invoice) => {
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', invoice.id);

      if (error) throw error;
      setToast({ type: 'success', message: `Invoice ${invoice.invoice_number} marked as paid` });
      fetchInvoices();
    } catch {
      setToast({ type: 'error', message: 'Failed to update invoice status' });
    }
  };

  const handleExportCsv = () => {
    exportToCsv(
      'invoices',
      ['Invoice #', 'Customer', 'Customer Email', 'Job Ref', 'Total', 'Status', 'Date'],
      filtered.map((inv) => [
        inv.invoice_number,
        inv.customer_name,
        inv.customer_email,
        inv.job_reference_id,
        inv.total_price,
        inv.status,
        inv.created_at,
      ])
    );
  };

  const filtered = invoices.filter((inv) => {
    const matchesSearch =
      !search.trim() ||
      inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      inv.job_reference_id.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer_email.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const { getPageItems, totalItems, pageSize } = usePagination(filtered, 25);
  const pageItems = getPageItems(page);

  const statusCounts = invoices.reduce(
    (acc, inv) => {
      acc[inv.status] = (acc[inv.status] || 0) + 1;
      acc.all = (acc.all || 0) + 1;
      return acc;
    },
    { all: 0 } as Record<string, number>
  );

  const totalRevenue = invoices
    .filter((i) => i.status === 'paid')
    .reduce((s, i) => s + i.total_price, 0);

  const totalOutstanding = invoices
    .filter((i) => i.status === 'sent' || i.status === 'overdue')
    .reduce((s, i) => s + i.total_price, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-moveme-blue-600 animate-spin" />
      </div>
    );
  }

  if (selectedInvoice) {
    return (
      <InvoicePDFViewer
        invoice={selectedInvoice}
        onBack={() => setSelectedInvoice(null)}
        onSendEmail={() => handleSendEmail(selectedInvoice)}
        onMarkPaid={() => handleMarkPaid(selectedInvoice)}
        sendingEmail={sendingEmail === selectedInvoice.id}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage and track all delivery invoices
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
          <button
            onClick={fetchInvoices}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-card transition-shadow">
          <div className="w-10 h-10 bg-moveme-blue-50 rounded-xl flex items-center justify-center mb-3">
            <FileText className="w-5 h-5 text-moveme-blue-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 mb-1">Total Invoices</p>
          <p className="text-xl font-bold text-gray-900">{invoices.length}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-card transition-shadow">
          <div className="w-10 h-10 bg-success-50 rounded-xl flex items-center justify-center mb-3">
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 mb-1">Paid Revenue</p>
          <p className="text-xl font-bold text-gray-900">{ttd(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-card transition-shadow">
          <div className="w-10 h-10 bg-warning-50 rounded-xl flex items-center justify-center mb-3">
            <Calendar className="w-5 h-5 text-warning-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 mb-1">Outstanding</p>
          <p className="text-xl font-bold text-gray-900">{ttd(totalOutstanding)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-card transition-shadow">
          <div className="w-10 h-10 bg-moveme-blue-50 rounded-xl flex items-center justify-center mb-3">
            <Mail className="w-5 h-5 text-moveme-blue-600" />
          </div>
          <p className="text-xs font-medium text-gray-500 mb-1">Emails Sent</p>
          <p className="text-xl font-bold text-gray-900">
            {invoices.filter((i) => i.email_sent).length}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by invoice #, customer, job reference, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent"
              />
            </div>

            <div className="relative">
              <button
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <Filter className="w-4 h-4" />
                {statusFilter === 'all' ? 'All Status' : statusConfig[statusFilter]?.label || statusFilter}
                <ChevronDown className={`w-4 h-4 transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
              </button>

              {showFilterDropdown && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowFilterDropdown(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-elevated border border-gray-200 py-1 z-40">
                    {STATUS_FILTERS.map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setStatusFilter(s);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 text-sm hover:bg-gray-50 transition-colors flex items-center justify-between ${
                          s === statusFilter ? 'bg-gray-50 font-medium' : ''
                        }`}
                      >
                        <span className="capitalize">{s === 'all' ? 'All Status' : s}</span>
                        <span className="text-xs text-gray-400">{statusCounts[s] || 0}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-gray-500 border-b border-gray-100">
                <th className="px-5 py-3">Invoice #</th>
                <th className="px-3 py-3">Customer</th>
                <th className="px-3 py-3">Job Ref</th>
                <th className="px-3 py-3 text-right">Total</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 font-medium">No invoices found</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Invoices are auto-generated when jobs are completed
                    </p>
                  </td>
                </tr>
              ) : (
                pageItems.map((inv) => {
                  const sc = statusConfig[inv.status] || statusConfig.draft;
                  return (
                    <tr
                      key={inv.id}
                      className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="font-medium text-moveme-blue-600 hover:text-moveme-blue-700 hover:underline transition-colors"
                        >
                          {inv.invoice_number}
                        </button>
                      </td>
                      <td className="px-3 py-3.5">
                        <div>
                          <p className="font-medium text-gray-900 truncate max-w-[180px]">
                            {inv.customer_name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-400 truncate max-w-[180px]">
                            {inv.customer_email}
                          </p>
                        </div>
                      </td>
                      <td className="px-3 py-3.5 text-gray-600">
                        {inv.job_reference_id || '--'}
                      </td>
                      <td className="px-3 py-3.5 text-right font-semibold text-gray-900">
                        {ttd(inv.total_price)}
                      </td>
                      <td className="px-3 py-3.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}
                        >
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-gray-500">
                        {fmtDate(inv.created_at)}
                      </td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setSelectedInvoice(inv)}
                            title="View invoice"
                            className="p-1.5 text-gray-400 hover:text-moveme-blue-600 hover:bg-moveme-blue-50 rounded-lg transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSendEmail(inv)}
                            disabled={sendingEmail === inv.id}
                            title="Email to customer"
                            className="p-1.5 text-gray-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {sendingEmail === inv.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                          {inv.status !== 'paid' && inv.status !== 'cancelled' && (
                            <button
                              onClick={() => handleMarkPaid(inv)}
                              title="Mark as paid"
                              className="p-1.5 text-gray-400 hover:text-success-600 hover:bg-success-50 rounded-lg transition-colors"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <Pagination currentPage={page} totalItems={totalItems} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-elevated text-sm font-medium animate-fade-in ${
            toast.type === 'success'
              ? 'bg-success-50 text-success-700 border border-success-200'
              : 'bg-error-50 text-error-700 border border-error-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          {toast.message}
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
