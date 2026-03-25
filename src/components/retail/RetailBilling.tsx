import { useState, useEffect } from 'react';
import { Download, FileText, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

interface Invoice {
  id: string;
  invoice_number: string;
  amount: number;
  status: string;
  created_at: string;
  due_date: string;
}

export function RetailBilling({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const creditLimit = 50000;
  const currentBalance = invoices
    .filter(i => i.status === 'pending' || i.status === 'overdue')
    .reduce((sum, i) => sum + (i.amount || 0), 0);
  const usagePercent = Math.min((currentBalance / creditLimit) * 100, 100);

  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('invoices')
        .select('id, invoice_number, amount, status, created_at, due_date')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(12);
      setInvoices(data || []);
      setLoading(false);
    })();
  }, [profile?.id]);

  const formatCurrency = (val: number) =>
    `$${val.toLocaleString('en-TT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-TT', { month: 'short', day: 'numeric', year: 'numeric' });

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      paid: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Paid' },
      pending: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Pending' },
      overdue: { bg: 'bg-red-50', text: 'text-red-700', label: 'Overdue' },
    };
    const s = map[status] || map.pending;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
        {s.label}
      </span>
    );
  };

  const content = (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-slate-400 text-xs font-medium uppercase tracking-wider">Current Net-30 Balance</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(currentBalance)}</p>
          </div>
          <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-slate-300" />
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Credit Limit Usage</span>
            <span className="text-slate-300 font-medium">{formatCurrency(currentBalance)} / {formatCurrency(creditLimit)}</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                usagePercent > 80 ? 'bg-red-400' : usagePercent > 50 ? 'bg-amber-400' : 'bg-emerald-400'
              }`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-500">{usagePercent.toFixed(0)}% of credit limit used</p>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-3">Monthly Invoices</h3>
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-slate-200 rounded-xl">
            <Clock className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No invoices yet</p>
            <p className="text-xs text-slate-400 mt-1">Invoices will appear here after completed deliveries</p>
          </div>
        ) : (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-5 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <span>Invoice</span>
              <span>Date</span>
              <span>Due</span>
              <span>Status</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-slate-100">
              {invoices.map((inv) => (
                <div key={inv.id} className="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-4 px-5 py-4 hover:bg-slate-50/60 transition-colors items-center">
                  <span className="font-medium text-slate-800 text-sm">{inv.invoice_number || `INV-${inv.id.slice(0, 6)}`}</span>
                  <span className="text-sm text-slate-500 hidden md:block">{formatDate(inv.created_at)}</span>
                  <span className="text-sm text-slate-500 hidden md:block">{inv.due_date ? formatDate(inv.due_date) : '--'}</span>
                  <div>{statusBadge(inv.status)}</div>
                  <div className="flex items-center justify-between md:justify-end gap-3">
                    <span className="font-semibold text-slate-800 text-sm">{formatCurrency(inv.amount || 0)}</span>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-xl">
        <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Payment terms are Net-30 from invoice date. For billing inquiries contact your account manager or reach out via Support.
        </p>
      </div>
    </div>
  );

  if (embedded) return <div>{content}</div>;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center">
          <FileText className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Corporate Billing & Invoices</h2>
          <p className="text-sm text-gray-600">Net-30 balance and invoice history</p>
        </div>
      </div>
      {content}
    </div>
  );
}
