import { X, Bike, ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const COURIER_TERMS_VERSION = '1.0';

const sections = [
  {
    title: '1. The Independent Contractor Relationship',
    content: `By registering as a Driver, Courier, or Transport Provider (collectively, "Driver") on the MoveMeTT platform, you explicitly agree and acknowledge that you are an independent contractor, running your own independent business.

No Employment: You are NOT an employee, agent, joint venturer, or partner of MoveMeTT Ltd.

No Benefits: You are not entitled to worker's compensation, holiday pay, health insurance, or any other employee benefits.

Taxes: You are solely responsible for declaring your income and paying all applicable taxes to the Board of Inland Revenue (BIR) of Trinidad & Tobago.

Autonomy: You have complete control over when you log into the app, which jobs you choose to accept or reject, and your routing (subject to standard delivery timeframes).`,
  },
  {
    title: '2. Licensing, Vehicle Standards & Insurance',
    content: `To access the platform, you must legally maintain the following at your own expense. Failure to do so will result in immediate permanent deactivation:

Valid Documents: A valid Trinidad & Tobago Driver's Permit for your specific vehicle class (e.g., Light Motor Vehicle, Heavy Goods).

Vehicle Roadworthiness: Your vehicle must possess a valid inspection sticker, be mechanically sound, and be visually presentable.

Mandatory Insurance: You must maintain adequate commercial or "Goods in Transit" motor vehicle insurance. MoveMeTT's platform insurance (if applicable) is strictly secondary. In the event of an accident, your personal/commercial auto insurance is the primary policy responsible for third-party damages, bodily injury, and cargo loss.`,
  },
  {
    title: '3. Financials: Fares, Commissions & Payouts',
    content: `Platform Fee: MoveMeTT acts as a lead-generation and dispatch service. For every successfully completed job, MoveMeTT will deduct a pre-agreed Platform Commission (e.g., 15%) from the total gross fare.

100% of Tips: Any gratuities or tips provided by the Customer belong 100% to you. MoveMeTT takes zero commission on tips.

Payouts: Your net earnings will be remitted to your designated local bank account or digital wallet on the platform's standard payout schedule (e.g., weekly or daily). MoveMeTT reserves the right to withhold payouts if fraud, theft, or severe customer disputes are under active investigation.`,
  },
  {
    title: '4. Operational Protocols & Strict Driver Rules',
    content: `As an independent operator utilizing the MoveMeTT software, you agree to adhere to the following operational safeguards:

The "Safe Buy" No-Cash Rule: For Marketplace proxy pickups, you are strictly prohibited from carrying or handing over your own physical cash to third-party sellers. All transactions must be digital. If you violate this rule, MoveMeTT is not liable for your financial loss or personal safety.

The 25-Minute Detention Protocol: If a customer is unresponsive upon your arrival, you must trigger the in-app timer. If the 25-minute maximum limit is reached, you are authorized to abort the delivery. Crucially, you are legally obligated to return the cargo to the original pickup location or a designated MoveMeTT safe zone. Abandoning or keeping the cargo constitutes theft.

Junk Removal Declarations: You have the right to inspect any "Junk Removal" load before loading. If you identify hazardous waste, wet chemicals, or asbestos, you must reject the load, cancel the job in the app, and leave the premises safely.`,
  },
  {
    title: '5. Assumption of Risk & Indemnification',
    content: `You acknowledge that driving and transporting heavy goods carry inherent risks of property damage, traffic accidents, theft, and bodily injury.

You Bear the Risk: You agree to assume all risks associated with performing these services. MoveMeTT is not liable if you are injured while carrying a heavy appliance, if your vehicle breaks down, or if you are a victim of a crime while using the app.

Indemnification: You agree to fully indemnify and hold MoveMeTT Ltd. harmless from any claims, lawsuits, or fines arising from your actions. This includes, but is not limited to: traffic tickets, speeding fines from the TTPS, vehicular manslaughter, destruction of customer property, or verbal/physical altercations with customers.`,
  },
  {
    title: '6. Zero Tolerance & Account Deactivation',
    content: `MoveMeTT maintains a strict, zero-tolerance policy to protect the integrity of the platform. Your account will be permanently deactivated without warning for any of the following:

\u2022 Theft or Tampering: Opening, tampering with, or stealing customer cargo.
\u2022 Intoxication: Operating your vehicle under the influence of alcohol, narcotics, or illegal substances.
\u2022 Aggressive Behavior: Physical violence, sexual harassment, or verbal abuse directed at customers, retail staff, or MoveMeTT support staff.
\u2022 Fraud: Manipulating the GPS, artificially inflating wait times, or conspiring with customers to bypass the platform (e.g., taking the job "off-app" for cash).
\u2022 Quality Standards: Falling below the minimum required platform Star Rating (e.g., 4.2 out of 5 stars) based on verified customer reviews.`,
  },
  {
    title: '7. Governing Law',
    content: `These Terms are governed by the laws of the Republic of Trinidad and Tobago. Any disputes shall be resolved through binding arbitration or the competent courts located in Port of Spain.`,
  },
];

export { sections as courierSections };

export function CourierTermsOfServiceModal({ open, onClose }: Props) {
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
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <Bike className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Courier Terms of Service</h2>
              <p className="text-xs text-gray-500">MoveMeTT Ltd. Driver Agreement -- Version {COURIER_TERMS_VERSION}</p>
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
