import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  Send,
  Download,
  CheckCircle2,
  Loader2,
  Building2,
  MapPin,
  Truck,
  Calendar,
  User,
  Mail,
  Phone,
  Hash,
  Printer,
} from 'lucide-react';

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

interface CompanySettings {
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  tax_registration_number: string;
  logo_url: string;
  invoice_footer_text: string;
}

interface InvoicePDFViewerProps {
  invoice: Invoice;
  onBack: () => void;
  onSendEmail: () => void;
  onMarkPaid: () => void;
  sendingEmail: boolean;
}

const ttd = (v: number | null | undefined) =>
  v != null
    ? `TT$${Number(v).toLocaleString('en-TT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : '--';

const fmtDate = (d: string | null) =>
  d
    ? new Date(d).toLocaleDateString('en-TT', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '--';

const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-600', label: 'Draft' },
  sent: { bg: 'bg-moveme-blue-50', text: 'text-moveme-blue-700', label: 'Sent' },
  paid: { bg: 'bg-success-50', text: 'text-success-700', label: 'Paid' },
  overdue: { bg: 'bg-error-50', text: 'text-error-700', label: 'Overdue' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-500', label: 'Cancelled' },
};

export function InvoicePDFViewer({ invoice, onBack, onSendEmail, onMarkPaid, sendingEmail }: InvoicePDFViewerProps) {
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [loadingCompany, setLoadingCompany] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchCompanySettings = async () => {
      try {
        const { data } = await supabase
          .from('company_settings')
          .select('company_name, company_address, company_email, company_phone, tax_registration_number, logo_url, invoice_footer_text')
          .maybeSingle();

        if (data) setCompany(data as CompanySettings);
      } catch (err) {
        console.error('Failed to load company settings:', err);
      } finally {
        setLoadingCompany(false);
      }
    };
    fetchCompanySettings();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-invoice`;
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ invoice_id: invoice.id, action: 'download' }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${invoice.invoice_number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      handlePrint();
    }
  };

  const sc = statusConfig[invoice.status] || statusConfig.draft;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900">{invoice.invoice_number}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>
                {sc.label}
              </span>
              <span className="text-xs text-gray-400">
                Created {fmtDate(invoice.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download
          </button>
          <button
            onClick={onSendEmail}
            disabled={sendingEmail}
            className="flex items-center gap-2 px-4 py-2.5 bg-moveme-blue-600 text-white rounded-xl text-sm font-medium hover:bg-moveme-blue-700 transition-colors disabled:opacity-50 shadow-sm"
          >
            {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Email Invoice
          </button>
          {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
            <button
              onClick={onMarkPaid}
              className="flex items-center gap-2 px-4 py-2.5 bg-success-600 text-white rounded-xl text-sm font-medium hover:bg-success-700 transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Mark Paid
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex-1" ref={printRef}>
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm print:shadow-none print:border-0 print:rounded-none">
            <div className="p-8 sm:p-10">
              <div className="flex items-start justify-between mb-10">
                <div className="flex items-start gap-4">
                  {loadingCompany ? (
                    <div className="w-16 h-16 bg-gray-100 rounded-xl animate-pulse" />
                  ) : company?.logo_url ? (
                    <img src={company.logo_url} alt="" className="w-16 h-16 object-contain" />
                  ) : (
                    <div className="w-16 h-16 bg-moveme-blue-50 rounded-xl flex items-center justify-center">
                      <Building2 className="w-8 h-8 text-moveme-blue-600" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {company?.company_name || 'MoveMe TT'}
                    </h2>
                    {company?.company_address && (
                      <p className="text-sm text-gray-500 mt-1 max-w-[280px] leading-relaxed whitespace-pre-line">
                        {company.company_address}
                      </p>
                    )}
                    {company?.company_email && (
                      <p className="text-sm text-gray-500 mt-0.5">{company.company_email}</p>
                    )}
                    {company?.company_phone && (
                      <p className="text-sm text-gray-500">{company.company_phone}</p>
                    )}
                    {company?.tax_registration_number && (
                      <p className="text-xs text-gray-400 mt-1">
                        Tax Reg: {company.tax_registration_number}
                      </p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className="inline-flex items-center gap-2 bg-moveme-blue-50 px-4 py-2 rounded-xl mb-3">
                    <span className="text-sm font-bold text-moveme-blue-700 uppercase tracking-wider">
                      Invoice
                    </span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{invoice.invoice_number}</p>
                  <p className="text-sm text-gray-500 mt-1">Date: {fmtDate(invoice.created_at)}</p>
                  {invoice.paid_at && (
                    <p className="text-sm text-success-600 mt-0.5 font-medium">
                      Paid: {fmtDate(invoice.paid_at)}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-10">
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Bill To
                  </p>
                  <p className="text-sm font-semibold text-gray-900">{invoice.customer_name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{invoice.customer_email}</p>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Delivered By
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {invoice.courier_name || 'Unassigned'}
                  </p>
                  <p className="text-sm text-gray-500 mt-0.5 capitalize">
                    {invoice.delivery_type || 'Standard'} Delivery
                  </p>
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 mb-8">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Delivery Details
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 bg-success-50 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                      <MapPin className="w-3 h-3 text-success-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase">Pickup</p>
                      <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">
                        {invoice.pickup_location || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <div className="w-6 h-6 bg-error-50 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                      <MapPin className="w-3 h-3 text-error-600" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold text-gray-400 uppercase">Drop-off</p>
                      <p className="text-sm text-gray-700 mt-0.5 leading-relaxed">
                        {invoice.dropoff_location || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Hash className="w-3 h-3" />
                    Job: {invoice.job_reference_id || invoice.job_id.slice(0, 8)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Truck className="w-3 h-3" />
                    {invoice.delivery_type || 'Standard'}
                  </div>
                </div>
              </div>

              <div className="mb-8">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">
                        Description
                      </th>
                      <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider pb-3">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-4">
                        <p className="text-sm font-medium text-gray-900">Delivery Service</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {invoice.pickup_location ? `${invoice.pickup_location.split(',')[0]} to ${(invoice.dropoff_location || '').split(',')[0]}` : 'Delivery service'}
                        </p>
                      </td>
                      <td className="py-4 text-right text-sm font-medium text-gray-900">
                        {ttd(invoice.base_price)}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-100">
                      <td className="py-3">
                        <p className="text-sm text-gray-600">Platform Fee</p>
                      </td>
                      <td className="py-3 text-right text-sm text-gray-600">
                        {ttd(invoice.platform_fee)}
                      </td>
                    </tr>
                    {invoice.vat_amount > 0 && (
                      <tr className="border-b border-gray-100">
                        <td className="py-3">
                          <p className="text-sm text-gray-600">VAT</p>
                        </td>
                        <td className="py-3 text-right text-sm text-gray-600">
                          {ttd(invoice.vat_amount)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="pt-4 pb-2">
                        <p className="text-base font-bold text-gray-900">Total Due</p>
                      </td>
                      <td className="pt-4 pb-2 text-right">
                        <p className="text-lg font-bold text-gray-900">{ttd(invoice.total_price)}</p>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {invoice.status === 'paid' && (
                <div className="flex items-center justify-center py-4 mb-6">
                  <div className="border-2 border-success-300 rounded-xl px-6 py-3 transform -rotate-3">
                    <p className="text-2xl font-black text-success-500 uppercase tracking-widest">
                      Paid
                    </p>
                  </div>
                </div>
              )}

              {company?.invoice_footer_text && (
                <div className="border-t border-gray-200 pt-6 text-center">
                  <p className="text-sm text-gray-500 italic">
                    {company.invoice_footer_text}
                  </p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-4 mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-gray-400">
                {company?.company_email && (
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {company.company_email}
                  </span>
                )}
                {company?.company_phone && (
                  <span className="flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {company.company_phone}
                  </span>
                )}
                {company?.tax_registration_number && (
                  <span>Tax Reg: {company.tax_registration_number}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:block w-72 flex-shrink-0 print:hidden">
          <div className="bg-white rounded-2xl border border-gray-100 p-5 sticky top-24 space-y-5">
            <h3 className="text-sm font-semibold text-gray-900">Invoice Details</h3>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase">Status</p>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-1 ${sc.bg} ${sc.text}`}>
                  {sc.label}
                </span>
              </div>

              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase">Created</p>
                <p className="text-sm text-gray-700 mt-0.5">{fmtDate(invoice.created_at)}</p>
              </div>

              {invoice.sent_at && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Sent</p>
                  <p className="text-sm text-gray-700 mt-0.5">{fmtDate(invoice.sent_at)}</p>
                </div>
              )}

              {invoice.paid_at && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Paid</p>
                  <p className="text-sm text-success-600 font-medium mt-0.5">{fmtDate(invoice.paid_at)}</p>
                </div>
              )}

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase">Email Status</p>
                <p className={`text-sm mt-0.5 ${invoice.email_sent ? 'text-success-600' : 'text-gray-500'}`}>
                  {invoice.email_sent ? 'Delivered' : 'Not sent'}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Breakdown</p>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Base</span>
                    <span className="text-gray-700">{ttd(invoice.base_price)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Platform Fee</span>
                    <span className="text-gray-700">{ttd(invoice.platform_fee)}</span>
                  </div>
                  {invoice.vat_amount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">VAT</span>
                      <span className="text-gray-700">{ttd(invoice.vat_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t border-gray-100 pt-1.5">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">{ttd(invoice.total_price)}</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1">
                    <span className="text-gray-400">Courier Earned</span>
                    <span className="text-gray-500">{ttd(invoice.courier_earnings)}</span>
                  </div>
                </div>
              </div>

              {invoice.notes && (
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase">Notes</p>
                  <p className="text-sm text-gray-600 mt-0.5">{invoice.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
