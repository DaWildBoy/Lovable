import { useState } from 'react';
import { X, CreditCard, Building2, ChevronDown, Check, Loader2 } from 'lucide-react';

interface CourierPayoutProps {
  open: boolean;
  onClose: () => void;
}

const TT_BANKS = [
  'Republic Bank',
  'First Citizens Bank (FCB)',
  'Scotiabank',
  'RBC Royal Bank',
];

export function CourierPayout({ open, onClose }: CourierPayoutProps) {
  const [form, setForm] = useState({
    bank: '',
    accountName: '',
    accountNumber: '',
    accountType: 'checking' as 'checking' | 'savings',
  });
  const [bankDropdown, setBankDropdown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  if (!open) return null;

  const isValid = form.bank && form.accountName.trim() && form.accountNumber.trim();

  const handleLink = async () => {
    if (!isValid) return;
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
      <header className="flex-shrink-0 bg-moveme-blue-900 text-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <CreditCard className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Earnings & Bank Linking</h1>
              <p className="text-xs text-white/50 mt-0.5">Securely connect your bank account</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-lg mx-auto p-4 space-y-4">
          {saved && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 flex items-center gap-3 animate-fade-in-up">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-emerald-800">Bank account linked successfully</p>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-50 flex items-center gap-2.5">
              <Building2 className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-gray-900">Bank Details</h3>
            </div>
            <div className="p-4 space-y-4">
              <div className="relative">
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Select Bank</label>
                <button
                  onClick={() => setBankDropdown(!bankDropdown)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-left flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                >
                  <span className={form.bank ? 'text-gray-900' : 'text-gray-400'}>
                    {form.bank || 'Choose your bank'}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${bankDropdown ? 'rotate-180' : ''}`} />
                </button>
                {bankDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-elevated z-10 py-1 animate-fade-in">
                    {TT_BANKS.map((bank) => (
                      <button
                        key={bank}
                        onClick={() => {
                          setForm({ ...form, bank });
                          setBankDropdown(false);
                        }}
                        className="w-full px-3.5 py-2.5 text-sm text-left text-gray-700 hover:bg-slate-50 transition-colors flex items-center justify-between"
                      >
                        {bank}
                        {form.bank === bank && <Check className="w-4 h-4 text-moveme-blue-600" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Account Name</label>
                <input
                  type="text"
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  placeholder="Name on bank account"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Account Number</label>
                <input
                  type="text"
                  value={form.accountNumber}
                  onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '') })}
                  placeholder="Enter account number"
                  inputMode="numeric"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-gray-200 rounded-xl text-sm text-gray-900 font-mono placeholder:text-gray-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-moveme-blue-500 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1.5">Account Type</label>
                <div className="flex gap-2">
                  {(['checking', 'savings'] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setForm({ ...form, accountType: type })}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98] ${
                        form.accountType === type
                          ? 'bg-moveme-blue-600 text-white shadow-sm'
                          : 'bg-slate-100 text-gray-500 hover:bg-slate-200'
                      }`}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleLink}
            disabled={!isValid || saving}
            className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-2xl transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Linking Account...
              </>
            ) : (
              'Securely Link Bank Account'
            )}
          </button>

          <p className="text-[11px] text-gray-400 text-center leading-relaxed pb-6">
            Your banking information is encrypted end-to-end and never shared with third parties.
          </p>
        </div>
      </div>
    </div>
  );
}
