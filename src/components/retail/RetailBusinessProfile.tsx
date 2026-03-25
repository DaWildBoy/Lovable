import { useState } from 'react';
import { Building2, TrendingUp, MapPin, FileText, Star, User, CreditCard, CheckCircle, ChevronDown, ChevronUp, Settings, Bell, Globe, Wallet as WalletIcon, MapPin as MapPinIcon, Receipt, Users, HardHat, UserX, ShieldAlert } from 'lucide-react';
import { RetailCompanyProfile } from './RetailCompanyProfile';
import { RetailAnalytics } from './RetailAnalytics';
import { RetailSavedLocations } from './RetailSavedLocations';
import { RetailDeliveryTemplates } from './RetailDeliveryTemplates';
import { RetailPreferredCouriers } from './RetailPreferredCouriers';
import { RetailBilling } from './RetailBilling';
import { RetailTeam } from './RetailTeam';
import { RetailYardRules } from './RetailYardRules';
import { RetailBlacklist } from './RetailBlacklist';
import { RetailClaims } from './RetailClaims';

type SectionKey = 'company' | 'performance' | 'locations' | 'templates' | 'preferred' | 'billing' | 'team' | 'yard_rules' | 'blacklist' | 'claims' | 'account' | 'settings';

interface RetailBusinessProfileProps {
  onNavigate: (path: string) => void;
}

const SECTIONS: { key: SectionKey; label: string; description: string; icon: typeof Building2; iconBg: string; iconColor: string }[] = [
  { key: 'company', label: 'Company Information', description: 'Business details and contacts', icon: Building2, iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
  { key: 'performance', label: 'Performance Overview', description: 'Metrics and analytics', icon: TrendingUp, iconBg: 'bg-green-100', iconColor: 'text-green-600' },
  { key: 'locations', label: 'Saved Locations', description: 'Frequently used addresses', icon: MapPin, iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
  { key: 'templates', label: 'Delivery Templates', description: 'Common delivery configurations', icon: FileText, iconBg: 'bg-teal-100', iconColor: 'text-teal-600' },
  { key: 'preferred', label: 'Preferred Couriers', description: 'Your favorite delivery providers', icon: Star, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
  { key: 'billing', label: 'Corporate Billing & Invoices', description: 'Net-30 balance and invoice history', icon: Receipt, iconBg: 'bg-slate-100', iconColor: 'text-slate-600' },
  { key: 'team', label: 'Team & Permissions', description: 'Manage dispatchers and access controls', icon: Users, iconBg: 'bg-sky-100', iconColor: 'text-sky-600' },
  { key: 'yard_rules', label: 'Yard Rules & Compliance', description: 'Driver instructions for every dispatch', icon: HardHat, iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
  { key: 'blacklist', label: 'Restricted Drivers', description: 'Manage blocked drivers', icon: UserX, iconBg: 'bg-red-100', iconColor: 'text-red-600' },
  { key: 'claims', label: 'Insurance & Claims', description: 'File cargo disputes and damage claims', icon: ShieldAlert, iconBg: 'bg-rose-100', iconColor: 'text-rose-600' },
  { key: 'account', label: 'Account', description: 'Profile and settings', icon: User, iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
  { key: 'settings', label: 'Settings', description: 'App preferences and configuration', icon: Settings, iconBg: 'bg-gray-100', iconColor: 'text-gray-600' },
];

export function RetailBusinessProfile({ onNavigate }: RetailBusinessProfileProps) {
  const [expandedSection, setExpandedSection] = useState<SectionKey | null>(null);

  const toggleSection = (key: SectionKey) => {
    setExpandedSection(expandedSection === key ? null : key);
  };

  return (
    <div className="space-y-4">
      {SECTIONS.map(({ key, label, description, icon: Icon, iconBg, iconColor }) => (
        <div key={key} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <button
            onClick={() => toggleSection(key)}
            className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 ${iconBg} ${iconColor} rounded-lg flex items-center justify-center`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="text-left">
                <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
                <p className="text-sm text-gray-600">{description}</p>
              </div>
            </div>
            {expandedSection === key ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {expandedSection === key && (
            <div className="border-t border-gray-100">
              {key === 'company' && <SectionCompany />}
              {key === 'performance' && <SectionPerformance />}
              {key === 'locations' && <SectionLocations />}
              {key === 'templates' && <SectionTemplates />}
              {key === 'preferred' && <SectionPreferred />}
              {key === 'billing' && <SectionBilling />}
              {key === 'team' && <SectionTeam />}
              {key === 'yard_rules' && <SectionYardRules />}
              {key === 'blacklist' && <SectionBlacklist />}
              {key === 'claims' && <SectionClaims />}
              {key === 'account' && <SectionAccount onNavigate={onNavigate} />}
              {key === 'settings' && <SectionSettings onNavigate={onNavigate} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function SectionCompany() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailCompanyProfile embedded />
    </div>
  );
}

function SectionPerformance() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailAnalytics embedded />
    </div>
  );
}

function SectionLocations() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailSavedLocations embedded />
    </div>
  );
}

function SectionTemplates() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailDeliveryTemplates embedded />
    </div>
  );
}

function SectionPreferred() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailPreferredCouriers embedded />
    </div>
  );
}

function SectionBilling() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailBilling embedded />
    </div>
  );
}

function SectionTeam() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailTeam embedded />
    </div>
  );
}

function SectionYardRules() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailYardRules embedded />
    </div>
  );
}

function SectionBlacklist() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailBlacklist embedded />
    </div>
  );
}

function SectionClaims() {
  return (
    <div className="px-6 pb-6 pt-4">
      <RetailClaims embedded />
    </div>
  );
}

function SectionAccount({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="px-6 pb-6">
      <div className="space-y-6 mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('/address-book')}
            className="bg-blue-50 border border-blue-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <MapPinIcon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-blue-900">Address Book</h3>
              </div>
            </div>
            <p className="text-xs text-blue-700">Manage saved addresses</p>
          </button>

          <button
            onClick={() => onNavigate('/payment-methods')}
            className="bg-amber-50 border border-amber-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-amber-900">Payment Methods</h3>
              </div>
            </div>
            <p className="text-xs text-amber-700">Manage cards</p>
          </button>

          <button
            onClick={() => onNavigate('/verification')}
            className="bg-teal-50 border border-teal-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-teal-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <CheckCircle className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-teal-900">Verification</h3>
              </div>
            </div>
            <p className="text-xs text-teal-700">Identity confirmed</p>
          </button>

          <button
            onClick={() => onNavigate('/wallet')}
            className="bg-green-50 border border-green-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <WalletIcon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-green-900">Wallet</h3>
              </div>
            </div>
            <p className="text-xs text-green-700">View balance and transactions</p>
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionSettings({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <div className="px-6 pb-6">
      <div className="mt-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => onNavigate('/settings')}
            className="bg-blue-50 border border-blue-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Settings className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-blue-900">Settings</h3>
              </div>
            </div>
            <p className="text-xs text-blue-700">App preferences</p>
          </button>

          <button
            onClick={() => onNavigate('/settings/notifications')}
            className="bg-green-50 border border-green-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Bell className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-green-900">Notifications</h3>
              </div>
            </div>
            <p className="text-xs text-green-700">Manage notification preferences</p>
          </button>

          <button
            onClick={() => onNavigate('/settings/language')}
            className="bg-slate-50 border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 bg-slate-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900">Language</h3>
              </div>
            </div>
            <p className="text-xs text-slate-700">English (Trinidad & Tobago)</p>
          </button>
        </div>
      </div>
    </div>
  );
}
