import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Building2,
  Upload,
  Save,
  Loader2,
  Image,
  MapPin,
  Mail,
  Phone,
  FileText,
  Hash,
  CheckCircle2,
  AlertCircle,
  X,
  Eye,
} from 'lucide-react';

interface CompanySettings {
  id: string;
  company_name: string;
  company_address: string;
  company_email: string;
  company_phone: string;
  tax_registration_number: string;
  logo_url: string;
  invoice_prefix: string;
  invoice_footer_text: string;
  currency_code: string;
}

export function AdminCompanySettings() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [previewLogo, setPreviewLogo] = useState(false);

  const [form, setForm] = useState({
    company_name: '',
    company_address: '',
    company_email: '',
    company_phone: '',
    tax_registration_number: '',
    logo_url: '',
    invoice_prefix: '',
    invoice_footer_text: '',
    currency_code: 'TTD',
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('company_settings')
        .select('*')
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as CompanySettings);
        setForm({
          company_name: data.company_name || '',
          company_address: data.company_address || '',
          company_email: data.company_email || '',
          company_phone: data.company_phone || '',
          tax_registration_number: data.tax_registration_number || '',
          logo_url: data.logo_url || '',
          invoice_prefix: data.invoice_prefix || 'MM',
          invoice_footer_text: data.invoice_footer_text || '',
          currency_code: data.currency_code || 'TTD',
        });
      }
    } catch (err) {
      console.error('Failed to load company settings:', err);
      setToast({ type: 'error', message: 'Failed to load company settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setToast({ type: 'error', message: 'Please upload an image file' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setToast({ type: 'error', message: 'Logo must be under 2MB' });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const fileName = `logo-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('company-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('company-assets')
        .getPublicUrl(fileName);

      setForm((prev) => ({ ...prev, logo_url: urlData.publicUrl }));
      setToast({ type: 'success', message: 'Logo uploaded' });
    } catch (err) {
      console.error('Logo upload error:', err);
      setToast({ type: 'error', message: 'Failed to upload logo' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.company_name.trim()) {
      setToast({ type: 'error', message: 'Company name is required' });
      return;
    }

    setSaving(true);
    try {
      if (settings?.id) {
        const { error } = await supabase
          .from('company_settings')
          .update({
            ...form,
            updated_at: new Date().toISOString(),
            updated_by: user?.id,
          })
          .eq('id', settings.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_settings')
          .insert({
            ...form,
            updated_by: user?.id,
          });

        if (error) throw error;
      }

      setToast({ type: 'success', message: 'Company settings saved' });
      fetchSettings();
    } catch (err) {
      console.error('Save error:', err);
      setToast({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-moveme-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Company Branding</h1>
          <p className="text-sm text-gray-500 mt-1">
            Configure your company details that appear on invoices
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-moveme-blue-600 text-white rounded-xl text-sm font-medium hover:bg-moveme-blue-700 transition-colors shadow-sm disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Image className="w-5 h-5 text-moveme-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Company Logo</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            This logo appears on all invoices and official documents
          </p>
        </div>

        <div className="px-5 py-6">
          <div className="flex items-start gap-6">
            <div className="relative group">
              {form.logo_url ? (
                <div
                  onClick={() => setPreviewLogo(true)}
                  className="w-28 h-28 rounded-2xl border-2 border-dashed border-gray-200 overflow-hidden cursor-pointer hover:border-moveme-blue-300 transition-colors"
                >
                  <img
                    src={form.logo_url}
                    alt="Company logo"
                    className="w-full h-full object-contain p-2"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                </div>
              ) : (
                <div className="w-28 h-28 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                  <Building2 className="w-8 h-8 mb-1" />
                  <span className="text-[10px] font-medium">No logo</span>
                </div>
              )}
            </div>

            <div className="flex-1 space-y-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading ? 'Uploading...' : 'Upload Logo'}
              </button>
              <p className="text-xs text-gray-400">
                PNG, JPG or SVG. Max 2MB. Recommended: 400x400px or larger, square format.
              </p>
              {form.logo_url && (
                <button
                  onClick={() => setForm((prev) => ({ ...prev, logo_url: '' }))}
                  className="text-xs text-error-600 hover:text-error-700 font-medium transition-colors"
                >
                  Remove logo
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-moveme-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Company Details</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Business information displayed on invoices
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              Company Name *
            </label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
              placeholder="MoveMe TT"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <MapPin className="w-3.5 h-3.5 text-gray-400" />
              Registered Address
            </label>
            <textarea
              value={form.company_address}
              onChange={(e) => setForm((p) => ({ ...p, company_address: e.target.value }))}
              placeholder="123 Business Street, Port of Spain, Trinidad & Tobago"
              rows={3}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                <Mail className="w-3.5 h-3.5 text-gray-400" />
                Contact Email
              </label>
              <input
                type="email"
                value={form.company_email}
                onChange={(e) => setForm((p) => ({ ...p, company_email: e.target.value }))}
                placeholder="invoices@movemett.com"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                <Phone className="w-3.5 h-3.5 text-gray-400" />
                Contact Phone
              </label>
              <input
                type="tel"
                value={form.company_phone}
                onChange={(e) => setForm((p) => ({ ...p, company_phone: e.target.value }))}
                placeholder="+1 868 123 4567"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
              <Hash className="w-3.5 h-3.5 text-gray-400" />
              Tax Registration Number
            </label>
            <input
              type="text"
              value={form.tax_registration_number}
              onChange={(e) => setForm((p) => ({ ...p, tax_registration_number: e.target.value }))}
              placeholder="BIR / VAT Registration Number"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-moveme-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Invoice Settings</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Customize how invoices are generated and numbered
          </p>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Invoice Number Prefix
              </label>
              <input
                type="text"
                value={form.invoice_prefix}
                onChange={(e) => setForm((p) => ({ ...p, invoice_prefix: e.target.value.toUpperCase() }))}
                placeholder="MM"
                maxLength={5}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent uppercase"
              />
              <p className="text-xs text-gray-400 mt-1">
                Preview: {form.invoice_prefix || 'MM'}-INV-00001
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                Currency
              </label>
              <select
                value={form.currency_code}
                onChange={(e) => setForm((p) => ({ ...p, currency_code: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent bg-white"
              >
                <option value="TTD">TTD - Trinidad & Tobago Dollar</option>
                <option value="USD">USD - US Dollar</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Invoice Footer Message
            </label>
            <textarea
              value={form.invoice_footer_text}
              onChange={(e) => setForm((p) => ({ ...p, invoice_footer_text: e.target.value }))}
              placeholder="Thank you for using MoveMe TT!"
              rows={2}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-moveme-blue-600" />
            <h2 className="text-base font-semibold text-gray-900">Invoice Preview</h2>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            How your branding will appear on invoices
          </p>
        </div>

        <div className="p-5">
          <div className="border border-gray-200 rounded-xl p-6 bg-gray-50/50 max-w-lg mx-auto">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                {form.logo_url ? (
                  <img src={form.logo_url} alt="" className="w-12 h-12 object-contain" />
                ) : (
                  <div className="w-12 h-12 bg-moveme-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-moveme-blue-600" />
                  </div>
                )}
                <div>
                  <p className="text-sm font-bold text-gray-900">
                    {form.company_name || 'Company Name'}
                  </p>
                  {form.company_address && (
                    <p className="text-[10px] text-gray-500 max-w-[200px] leading-relaxed">
                      {form.company_address}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold text-moveme-blue-600 uppercase tracking-wider">
                  Invoice
                </p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">
                  {form.invoice_prefix || 'MM'}-INV-00001
                </p>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300 pt-4 mb-4">
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <p className="text-gray-400">Bill To</p>
                  <p className="text-gray-700 font-medium">John Smith</p>
                  <p className="text-gray-500">john@example.com</p>
                </div>
                <div className="text-right">
                  <p className="text-gray-400">Date</p>
                  <p className="text-gray-700 font-medium">
                    {new Date().toLocaleDateString('en-TT', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300 pt-3 space-y-1.5 text-[10px]">
              <div className="flex justify-between">
                <span className="text-gray-500">Base Price</span>
                <span className="text-gray-700">TT$200.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Platform Fee</span>
                <span className="text-gray-700">TT$20.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">VAT</span>
                <span className="text-gray-700">TT$0.00</span>
              </div>
              <div className="flex justify-between font-bold border-t border-gray-200 pt-1.5 text-xs">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">TT$220.00</span>
              </div>
            </div>

            {form.invoice_footer_text && (
              <div className="mt-4 pt-3 border-t border-dashed border-gray-300">
                <p className="text-[9px] text-gray-400 text-center italic">
                  {form.invoice_footer_text}
                </p>
              </div>
            )}

            {(form.company_email || form.company_phone || form.tax_registration_number) && (
              <div className="mt-2 text-center text-[9px] text-gray-400 space-x-2">
                {form.company_email && <span>{form.company_email}</span>}
                {form.company_phone && <span>{form.company_phone}</span>}
                {form.tax_registration_number && (
                  <span>Tax Reg: {form.tax_registration_number}</span>
                )}
              </div>
            )}
          </div>
        </div>
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

      {previewLogo && form.logo_url && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setPreviewLogo(false)}>
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900">Logo Preview</h3>
              <button onClick={() => setPreviewLogo(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <img src={form.logo_url} alt="Company Logo" className="w-full max-h-64 object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
