import { X, FileText, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const TERMS_VERSION = '1.0';

const sections = [
  {
    title: '1. Acceptance of Terms',
    content: `By downloading, accessing, or using the MoveMeTT mobile application, website, or related services (collectively, the "Platform"), you ("User," "Customer," or "You") agree to be bound by these Terms of Service ("Terms"). If you do not agree to all terms and conditions, do not use the Platform.`,
  },
  {
    title: '2. Nature of the Service (The Platform Shield)',
    content: `MoveMeTT Ltd. is a technology platform, not a transportation carrier, logistics provider, or courier company. The Platform provides a digital marketplace connecting users seeking transportation, delivery, and logistics services with independent third-party contractors ("Drivers" or "Service Providers").

Independent Contractors: Drivers are independent business operators, not employees, agents, or joint venturers of MoveMeTT.

Limitation of Corporate Liability: MoveMeTT does not provide the actual transportation services and is not liable for the acts, omissions, negligence, or vehicular accidents of any third-party Driver.`,
  },
  {
    title: '3. Prohibited Items (Strict Liability)',
    content: `You agree NOT to use the Platform to transport any of the following items. If you violate this rule, you assume 100% legal and financial liability for any damages, fines, or criminal charges, and your account will be permanently banned:

\u2022 Physical cash, coins, or currency of any kind.
\u2022 Precious metals, high-value jewelry, or unsecured bearer bonds.
\u2022 Hazardous materials, toxic waste, asbestos, wet paint, flammable liquids, or explosives.
\u2022 Illegal drugs, narcotics, unregistered firearms, ammunition, or stolen goods.
\u2022 Live animals or human remains.

Drivers reserve the right to visually inspect unsealed cargo or parcels before accepting a job. Drivers may reject any job at their sole discretion if they suspect a violation.`,
  },
  {
    title: '4. Specific Service Rules & Policies',
    subsections: [
      {
        subtitle: 'A. Courier & Delivery Limits',
        content: `You must accurately declare the size and weight of your cargo. If you book a "Motorbike" courier and attempt to force the Driver to transport a large appliance or item exceeding 40 lbs, the Driver will cancel the job, and you will be charged a 100% Cancellation Fee.`,
      },
      {
        subtitle: 'B. Detention Fees & The 25-Minute Auto-Cancellation',
        content: `Drivers' time is their livelihood. When a Driver arrives at your designated Pickup or Drop-off location, the following strict detention policies apply:

\u2022 0\u20139 Minutes: Grace Period.
\u2022 10 Minutes: A $100.00 TTD waiting penalty is added to your invoice.
\u2022 15 Minutes: The penalty increases to $150.00 TTD.
\u2022 20 Minutes: The penalty increases to $200.00 TTD.
\u2022 25-Minute Kill Switch: If 25 minutes elapse without contact or active loading, the Driver is instructed to terminate the job and return the cargo to the point of origin. You will be charged the FULL original fare PLUS the $200.00 TTD maximum waiting fee.

Exception: The timer may be paused by the Driver exclusively during the active, physical loading/unloading of heavy cargo.`,
      },
      {
        subtitle: 'C. Junk Removal & Waste Disposal',
        content: `By booking Junk Removal, you explicitly guarantee the load contains NO hazardous materials. You must accurately declare if the junk is "Curbside" or requires "Heavy Lifting/Inside Removal." If you declare "Curbside" but the Driver is required to enter the property or climb stairs, a mandatory $150.00 TTD Labor Surcharge will be added. Mandatory SWMCOL or private landfill gate fees are automatically included in your quote.`,
      },
      {
        subtitle: 'D. Marketplace "Safe Buy" (Proxy Service)',
        content: `When utilizing MoveMeTT as a proxy to pick up items from third-party sellers (e.g., Facebook Marketplace, Pin.tt):

No Cash Rule: Drivers will absolutely not carry physical cash to pay sellers. All payments to sellers must be handled digitally by You (e.g., Bank Transfer) before or immediately after Driver inspection.

Liability for Defects: The Driver will perform a basic visual inspection based ONLY on a maximum of three (3) instructions provided by You. Once the Driver leaves the seller's location, MoveMeTT and the Driver are completely absolved of any liability regarding hidden defects, internal damages, or counterfeit status of the item.`,
      },
    ],
  },
  {
    title: '5. Cargo Liability, Damage & Insurance',
    content: `Standard Liability Limit: Unless optional Cargo Insurance is purchased through the Platform prior to the trip, MoveMeTT's total maximum liability to you for any lost, stolen, or damaged goods is strictly limited to the total delivery fee paid for that specific trip, regardless of the actual value of the item.

Optional Cargo Insurance: You may opt to purchase extended Cargo Protection (e.g., a 1.5% surcharge on declared value) at checkout. This is subject to third-party underwriting terms and requires photographic proof of the item's condition prior to transit.

Weather Disclaimer: If you book an open-tray vehicle (e.g., flatbed or pickup) against Platform weather warnings, you assume all risk for water or environmental damage to your goods.`,
  },
  {
    title: '6. Payments, Billing & Authorization',
    content: `All estimates are provided in Trinidad & Tobago Dollars (TTD). By adding a credit/debit card, you authorize MoveMeTT (via our payment processors, e.g., Stripe, WiPay) to place a temporary hold for the estimated fare and to automatically charge the final amount\u2014including any applicable tolls, detention fees, heavy-lifting surcharges, or cancellation fees\u2014upon completion or termination of the job.`,
  },
  {
    title: '7. Indemnification',
    content: `You agree to indemnify, defend, and hold harmless MoveMeTT Ltd., its directors, employees, and third-party Drivers from any claims, lawsuits, losses, liabilities, damages, or expenses (including attorney's fees) arising from:

\u2022 Your breach of these Terms.
\u2022 Your violation of any law or the rights of a third party.
\u2022 Any harm, injury, or property damage caused by the cargo you requested to be transported.`,
  },
  {
    title: '8. Disclaimer of Warranties',
    content: `THE PLATFORM AND SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE." MOVEMETT EXPRESSLY DISCLAIMS ALL WARRANTIES, WHETHER EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. MOVEMETT DOES NOT GUARANTEE THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR PERFECTLY SECURE.`,
  },
  {
    title: '9. Governing Law & Dispute Resolution',
    content: `These Terms are governed by and construed in accordance with the laws of the Republic of Trinidad and Tobago. Any dispute, claim, or controversy arising out of or relating to these Terms or the breach thereof shall be resolved exclusively through binding arbitration or the competent courts located in Port of Spain, Trinidad.`,
  },
];

export function TermsOfServiceModal({ open, onClose }: Props) {
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
            <div className="w-10 h-10 bg-moveme-blue-50 rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5 text-moveme-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Terms of Service</h2>
              <p className="text-xs text-gray-500">MoveMeTT Ltd. -- Version {TERMS_VERSION}</p>
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
              {section.content && (
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                  {section.content}
                </p>
              )}
              {section.subsections && (
                <div className="space-y-4 mt-3">
                  {section.subsections.map((sub, j) => (
                    <div key={j}>
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">{sub.subtitle}</h4>
                      <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                        {sub.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
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
