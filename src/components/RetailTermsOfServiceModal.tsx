import { X, Building2, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const RETAIL_TERMS_VERSION = '1.0';

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

export function RetailTermsOfServiceModal({ open, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showScrollHint, setShowScrollHint] = useState(true);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setShowScrollHint(true);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop } = scrollRef.current;
    if (scrollTop > 100) setShowScrollHint(false);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-fade-in-up">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Retail Business Terms of Service</h2>
              <p className="text-xs text-gray-500">MoveMeTT Ltd. B2B Agreement -- Version {RETAIL_TERMS_VERSION}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-5 space-y-6"
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

        {showScrollHint && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-900/70 text-white text-xs rounded-full animate-bounce">
              <ChevronDown className="w-3 h-3" />
              Scroll to read more
            </div>
          </div>
        )}

        <div className="p-4 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full btn-primary py-3"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
