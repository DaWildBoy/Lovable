import { useState, useRef, useEffect } from 'react';
import { Building2, ChevronDown, LogOut, Loader2, ArrowLeft } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RETAIL_TERMS_VERSION } from '../components/RetailTermsOfServiceModal';
import { MoveMeLogo } from '../components/MoveMeLogo';

const sections = [
  {
    title: '1. Acceptance & Nature of the Agreement',
    content: `By registering for a MoveMeTT "Business" or "Retail" Account, accessing the Retail Web Dashboard, or utilizing the MoveMeTT API (collectively, the "B2B Platform"), your organization ("Retailer," "Merchant," or "Client") agrees to be bound by these Terms of Service.

The Platform Shield: MoveMeTT Ltd. is a technology software platform providing digital dispatch, routing, and invoicing solutions. MoveMeTT is not a licensed freight forwarder, motor carrier, or transportation company. All actual transportation is performed by independent third-party contractors ("Drivers").`,
  },
  {
    title: '2. Dashboard Access & Account Security',
    content: `Retailers are granted access to a centralized Web Dashboard for bulk dispatching and tracking.

You are strictly responsible for maintaining the confidentiality of all login credentials associated with your corporate account.

MoveMeTT holds the Retailer 100% financially liable for any and all jobs dispatched from your account, whether authorized by management or accidentally triggered by an employee.`,
  },
  {
    title: '3. Loading Bay Protocols & Detention Fees',
    content: `Unlike standard consumer pickups, B2B dispatches often involve warehouses, loading bays, and heavy machinery (e.g., forklifts). The following rules apply to all Retail pickups:

Active Loading State: Drivers will engage an "Active Loading" status upon arrival and contact at your facility. During this state, the standard consumer waiting penalty is paused to allow for safe, industrial loading.

Warehouse Delays (Idle Detention): If a Driver arrives at your designated facility and is forced to wait idly for more than 30 minutes before loading commences, MoveMeTT reserves the right to automatically bill your corporate account a Commercial Detention Fee (e.g., $150.00 TTD per 30-minute block) to compensate the Driver for lost revenue.

Loading Liability: Retailers are solely responsible for safely and securely loading cargo onto the Driver's vehicle. MoveMeTT and its Drivers are NOT liable for any damage to goods, the Driver's vehicle, or personal injury caused by your employees, forklift operators, or defective warehouse equipment during the loading process.`,
  },
  {
    title: '4. Proof of Delivery (POD) & E-Signatures',
    content: `The MoveMeTT platform utilizes digital Electronic Signatures (E-Signatures) and geo-tagged photographic evidence to establish Proof of Delivery (POD).

Binding Acknowledgment: Once a Driver secures an E-Signature or photographic proof at the Drop-off location, the delivery is legally deemed completed in full.

Dispute Waiver: The Retailer agrees to accept MoveMeTT's digital POD as absolute proof of fulfillment. MoveMeTT will not entertain claims of "missing cargo" from the Retailer if a valid POD (signed by the Retailer's end-customer or their representative) is recorded in the Dashboard.`,
  },
  {
    title: '5. Invoicing, Payments & Net-30 Terms',
    content: `Approved B2B Retailers may be granted consolidated monthly invoicing (e.g., Net-15 or Net-30 terms).

Payment Obligation: Retailers agree to remit full payment in Trinidad & Tobago Dollars (TTD) by the due date specified on the monthly invoice.

Late Fees & Default: Failure to pay within the agreed terms will result in an immediate suspension of Dashboard dispatch privileges. MoveMeTT reserves the right to apply a late payment penalty of 1.5% per month on all outstanding balances.

No Offset: The Retailer may not withhold, offset, or deduct any amounts owed to MoveMeTT under the guise of pending cargo damage claims or customer disputes.`,
  },
  {
    title: '6. High-Value Cargo & Insurance Limits',
    content: `MoveMeTT explicitly limits its liability for B2B cargo.

Standard Cap: MoveMeTT's total maximum liability for lost, stolen, or damaged commercial goods is strictly capped at the cost of the delivery fee for that specific dispatch, regardless of the wholesale or retail value of the cargo (e.g., a $10,000 appliance).

Retailer's Duty to Insure: It is the explicit responsibility of the Retailer to maintain their own comprehensive "Goods in Transit" commercial insurance policy to cover high-value shipments.

Platform Insurance Extension: If the Retailer opts to utilize MoveMeTT's integrated per-trip Cargo Protection (surcharge applied at dispatch), claims are subject to the third-party underwriter's terms and require strict pre-dispatch photographic evidence of the cargo's pristine condition.`,
  },
  {
    title: '7. Reverse Logistics (Returns)',
    content: `If a Retailer utilizes the Platform to execute a "Return to Store" job (retrieving goods from an end-customer):

The Retailer acknowledges that the Driver acts merely as a transporter. The Driver is not qualified to inspect the goods for mechanical defects, missing parts, or warranty voids.

The Retailer must pay the full return transit fee regardless of the condition of the goods upon arrival at the warehouse.`,
  },
  {
    title: '8. Indemnification',
    content: `The Retailer agrees to fully indemnify, defend, and hold MoveMeTT Ltd., its software providers, and independent Drivers harmless against any claims, losses, lawsuits, or damages arising from:

\u2022 Improperly secured, hazardous, or overweight cargo loaded by the Retailer's staff.
\u2022 Accidents or injuries occurring on the Retailer's premises during loading.
\u2022 Disputes between the Retailer and their end-customer regarding the quality, condition, or warranty of the transported retail goods.`,
  },
  {
    title: '9. Termination of B2B Services',
    content: `MoveMeTT reserves the right to instantly revoke Dashboard access and terminate this agreement if a Retailer utilizes the platform to transport illegal materials, consistently abuses Drivers, or defaults on invoicing terms.`,
  },
];

interface Props {
  onAccepted: () => void;
  onBack?: () => void;
}

export function RetailTermsAcceptancePage({ onAccepted, onBack }: Props) {
  const { user, signOut } = useAuth();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [scrolledToBottom, setScrolledToBottom] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollTop + clientHeight >= scrollHeight - 40) {
        setScrolledToBottom(true);
      }
    };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAccept = async () => {
    if (!checked || !user) return;
    setSaving(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          terms_accepted_at: new Date().toISOString(),
          terms_version: `retail-${RETAIL_TERMS_VERSION}`,
        })
        .eq('id', user.id);

      if (updateError) throw updateError;
      onAccepted();
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-emerald-50/30 flex flex-col">
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors mr-3"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
            <MoveMeLogo className="h-10 w-auto [&>svg]:h-10 [&>svg]:w-auto" />
          </div>
          <button
            onClick={signOut}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center p-4 pt-6 md:pt-10">
        <div className="w-full max-w-3xl animate-fade-in-up">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-50 mb-4">
              <Building2 className="w-7 h-7 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">
              Retail Business Terms of Service
            </h1>
            <p className="text-sm text-gray-500">
              Please review and accept the B2B terms to continue using your retail dashboard
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                MoveMeTT Ltd. B2B Agreement
              </span>
              <span className="text-xs text-gray-400">Version {RETAIL_TERMS_VERSION}</span>
            </div>

            <div
              ref={scrollRef}
              className="max-h-[50vh] overflow-y-auto p-5 space-y-5"
            >
              {sections.map((section, i) => (
                <div key={i}>
                  <h3 className="text-sm font-bold text-gray-900 mb-2">{section.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                    {section.content}
                  </p>
                </div>
              ))}
            </div>

            {!scrolledToBottom && (
              <div className="flex justify-center py-2 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-1 text-xs text-gray-400 animate-bounce">
                  <ChevronDown className="w-3.5 h-3.5" />
                  Scroll down to read the full agreement
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 bg-white rounded-2xl shadow-lg border border-gray-100 p-5">
            <div className="flex items-start gap-3 mb-4">
              <input
                type="checkbox"
                id="retail-terms-checkbox"
                checked={checked}
                onChange={(e) => setChecked(e.target.checked)}
                className="mt-1 h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer flex-shrink-0"
              />
              <label htmlFor="retail-terms-checkbox" className="text-sm text-gray-700 leading-relaxed cursor-pointer">
                I have read, understood, and agree to the{' '}
                <span className="font-semibold text-gray-900">MoveMeTT Retail Business Terms of Service</span>{' '}
                on behalf of my organization. I acknowledge that my company is bound by these terms for all dispatches made through the Platform.
              </label>
            </div>

            {error && (
              <div className="p-3 bg-error-50 border border-error-200 rounded-xl mb-4 animate-fade-in">
                <p className="text-sm text-error-600 font-medium">{error}</p>
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={!checked || saving}
              className="btn-primary w-full py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Saving...
                </>
              ) : (
                'Accept & Continue to Subscription'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
