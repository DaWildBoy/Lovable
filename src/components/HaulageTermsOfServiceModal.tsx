import { X, Truck, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const HAULAGE_TERMS_VERSION = '1.0';

const sections = [
  {
    title: '1. The Fleet Operator Relationship (The Software Shield)',
    content: `By registering a "Haulage," "Heavy Transport," or "Fleet Operator" profile on the MoveMeTT platform (the "Platform"), your company, its owners, and its authorized drivers (collectively, the "Carrier") agree to these Terms.

Technology Provider Status: MoveMeTT Ltd. operates exclusively as a digital dispatch, load-matching, and invoicing software platform. MoveMeTT is NOT a licensed motor carrier, freight forwarder, or transport company.

Independent Business: The Carrier acts as a wholly independent, licensed commercial enterprise. No employee, joint venture, or agency relationship exists between MoveMeTT and the Carrier or the Carrier's individual drivers.`,
  },
  {
    title: '2. Fleet Compliance & Legal Roadworthiness',
    content: `Operating heavy machinery on the roads of Trinidad & Tobago requires strict legal compliance. The Carrier guarantees that at all times while utilizing the Platform:

Driver Licensing: All personnel operating under the Carrier's profile possess the appropriate valid Trinidad & Tobago driving permits for heavy motor vehicles (e.g., Class 4, Class 5, or Class 6).

Specialized Certification: Any operator accepting jobs requiring specialized equipment (e.g., Hiab cranes, tipping mechanisms) is fully certified and trained to operate said machinery.

Vehicle Standards: All trucks, flatbeds, and heavy commercial vehicles must maintain valid inspection certificates from the Transport Division (Licensing Office), be mechanically sound, and be equipped with all legally required safety apparatus (reflectors, hazard lights).`,
  },
  {
    title: '3. Cargo Securement & Legal Weight Limits (Carrier Liability)',
    content: `In commercial haulage, the physical handling of the load carries the highest risk.

Strict Responsibility for Securement: The Carrier and its drivers are 100% legally and financially responsible for the safe loading, tying down, strapping, and securement of all cargo. MoveMeTT assumes ZERO liability for cargo that shifts, falls, or causes accidents during transit.

Overweight Refusal Right: The Carrier must comply with the Motor Vehicles and Road Traffic Act of Trinidad & Tobago. The Carrier has the absolute right and obligation to refuse any load that exceeds the vehicle's legal Gross Vehicle Weight (GVW) or violates weighbridge regulations. MoveMeTT will not penalize a Carrier for refusing an illegally overweight load.`,
  },
  {
    title: '4. Heavy Commercial Insurance Requirements',
    content: `Due to the high-value nature of industrial freight and the risk of catastrophic property damage, the Carrier must maintain the following at their own expense. MoveMeTT will permanently ban any Carrier whose insurance lapses.

Commercial Motor Insurance: A comprehensive commercial policy covering third-party bodily injury, traffic fatalities, and property damage (e.g., bridge strikes, damaging a client's warehouse).

Goods in Transit (Freight) Insurance: A commercial freight policy sufficient to cover the maximum value of the industrial cargo being hauled (e.g., construction materials, machinery).

MoveMeTT's platform insurance does NOT cover heavy commercial haulage. The Carrier's insurance is always the primary and sole policy responsible in the event of an incident.`,
  },
  {
    title: '5. Fleet Management & Subcontracting',
    content: `If the Carrier registers multiple trucks and drivers under a single MoveMeTT Fleet Profile:

The Carrier is vicariously liable for the actions, negligence, and behavior of every driver operating under their account.

The Carrier may not "double-broker" or subcontract a MoveMeTT job to an unregistered third-party trucking company. All jobs accepted on the Platform must be completed by vehicles and drivers explicitly vetted and registered on the Carrier's MoveMeTT profile.`,
  },
  {
    title: '6. Industrial Detention & Loading Bay Delays',
    content: `MoveMeTT recognizes that loading a flatbed takes longer than loading a courier bike.

Commercial Grace Period: Standard consumer detention timers are paused when a Haulage driver triggers the "Active Loading" state at a warehouse or job site.

Commercial Detention Billing: If the Carrier's truck is held idle at a pickup or drop-off location (e.g., waiting for a forklift, denied gate entry) for an unreasonable duration (exceeding 45 minutes), the Platform's commercial detention fees will activate, billing the client for the truck's lost operational time.`,
  },
  {
    title: '7. Full Indemnification (The Corporate Shield)',
    content: `The Carrier agrees to fully indemnify, defend, and hold MoveMeTT Ltd., its executives, and its retail clients harmless from any and all claims, lawsuits, massive financial losses, or criminal charges arising directly or indirectly from:

\u2022 Traffic accidents, fatalities, or infrastructure damage caused by the Carrier's heavy vehicles.
\u2022 Dropped, damaged, or improperly secured industrial cargo.
\u2022 Violations of TTPS traffic laws, weight limits, or environmental regulations (e.g., illegal dumping of construction debris during a Junk Removal job).
\u2022 Workplace injuries sustained by the Carrier's drivers at client loading bays.`,
  },
  {
    title: '8. Platform Fees & Financial Terms',
    content: `MoveMeTT will deduct its agreed-upon commercial dispatch commission from the gross fare of every completed haulage job.

For B2B corporate jobs operating on Net-30 invoicing, the Carrier agrees to MoveMeTT's scheduled payout terms, understanding that MoveMeTT acts as the payment collection agent.`,
  },
];

export { sections as haulageSections };

export function HaulageTermsOfServiceModal({ open, onClose }: Props) {
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
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Haulage Company Terms of Service</h2>
              <p className="text-xs text-gray-500">MoveMeTT Ltd. Fleet Operator Agreement -- Version {HAULAGE_TERMS_VERSION}</p>
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
