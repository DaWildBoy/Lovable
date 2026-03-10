import { useState } from 'react';
import {
  MessageCircle,
  Megaphone,
  MoreHorizontal,
  LogOut,
  ChevronRight,
  CreditCard,
  FileText,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { RetailTermsOfServiceModal } from './RetailTermsOfServiceModal';
import { HaulageTermsOfServiceModal } from './HaulageTermsOfServiceModal';
import { CourierTermsOfServiceModal } from './CourierTermsOfServiceModal';

interface MenuItem {
  icon: any;
  label: string;
  subtitle?: string;
  path?: string;
  action?: () => void;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface ProfileMenuSectionsProps {
  onNavigate: (path: string) => void;
  onLogout: () => void;
  showSubscription?: boolean;
}

export function ProfileMenuSections({ onNavigate, onLogout, showSubscription }: ProfileMenuSectionsProps) {
  const { profile } = useAuth();
  const [showRetailTerms, setShowRetailTerms] = useState(false);
  const [showHaulageTerms, setShowHaulageTerms] = useState(false);
  const [showCourierTerms, setShowCourierTerms] = useState(false);
  const isRetail = profile?.role === 'business' && profile?.business_type === 'retail';
  const isHaulage = profile?.role === 'business' && profile?.business_type === 'haulage';
  const isCourier = profile?.role === 'courier';

  const sections: MenuSection[] = [
    ...(showSubscription ? [{
      title: 'Billing',
      items: [
        {
          icon: CreditCard,
          label: 'Subscription',
          subtitle: 'Manage your plan and billing',
          path: '/subscription',
        },
      ],
    }] : []),
    {
      title: 'Support',
      items: [
        {
          icon: MessageCircle,
          label: 'Chat Support',
          subtitle: 'Get help from our team',
          path: '/support/chat',
        },
        {
          icon: Megaphone,
          label: 'Announcements',
          subtitle: 'Latest updates and news',
          path: '/announcements',
        },
      ],
    },
    {
      title: 'Other',
      items: [
        ...(isRetail ? [{
          icon: FileText,
          label: 'Terms of Service',
          subtitle: 'View retail business terms',
          action: () => setShowRetailTerms(true),
        }] : []),
        ...(isHaulage ? [{
          icon: FileText,
          label: 'Terms of Service',
          subtitle: 'View fleet operator terms',
          action: () => setShowHaulageTerms(true),
        }] : []),
        ...(isCourier ? [{
          icon: FileText,
          label: 'Terms of Service',
          subtitle: 'View courier driver terms',
          action: () => setShowCourierTerms(true),
        }] : []),
        {
          icon: MoreHorizontal,
          label: 'More',
          subtitle: 'Additional options',
          path: '/more',
        },
        {
          icon: LogOut,
          label: 'Logout',
          subtitle: 'Sign out of your account',
          action: onLogout,
        },
      ],
    },
  ];

  const handleItemClick = (item: MenuItem) => {
    if (item.action) {
      item.action();
    } else if (item.path) {
      onNavigate(item.path);
    }
  };

  return (
    <div className="px-4 pb-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 px-1">
              {section.title}
            </h2>
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === section.items.length - 1;

                return (
                  <button
                    key={item.label}
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-all text-left ${
                      !isLast ? 'border-b border-gray-100' : ''
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{item.label}</p>
                      {item.subtitle && (
                        <p className="text-sm text-gray-500 mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <RetailTermsOfServiceModal open={showRetailTerms} onClose={() => setShowRetailTerms(false)} />
      <HaulageTermsOfServiceModal open={showHaulageTerms} onClose={() => setShowHaulageTerms(false)} />
      <CourierTermsOfServiceModal open={showCourierTerms} onClose={() => setShowCourierTerms(false)} />
    </div>
  );
}
