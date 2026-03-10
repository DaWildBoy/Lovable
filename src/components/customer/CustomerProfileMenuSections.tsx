import { useState } from 'react';
import {
  UserCog,
  MapPin,
  Heart,
  Receipt,
  Sliders,
  Shield,
  Globe,
  Bell,
  MessageCircle,
  Megaphone,
  Star,
  FileText,
  MoreHorizontal,
  LogOut,
  ChevronRight,
} from 'lucide-react';
import { TermsOfServiceModal } from '../TermsOfServiceModal';

interface MenuItem {
  icon: typeof UserCog;
  label: string;
  subtitle?: string;
  path?: string;
  action?: () => void;
  color?: string;
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface Props {
  onNavigate: (path: string) => void;
  onLogout: () => void;
}

export function CustomerProfileMenuSections({ onNavigate, onLogout }: Props) {
  const [showTerms, setShowTerms] = useState(false);

  const sections: MenuSection[] = [
    {
      title: 'Account',
      items: [
        {
          icon: UserCog,
          label: 'Edit Profile',
          subtitle: 'Update your name, phone and photo',
          path: '/profile/edit',
          color: 'bg-blue-50 text-blue-600',
        },
        {
          icon: MapPin,
          label: 'Address Book',
          subtitle: 'Manage saved locations',
          path: '/address-book',
          color: 'bg-emerald-50 text-emerald-600',
        },
        {
          icon: Heart,
          label: 'Preferred Couriers',
          subtitle: 'Your top-rated drivers',
          path: '/customer/jobs?tab=completed',
          color: 'bg-rose-50 text-rose-600',
        },
        {
          icon: Receipt,
          label: 'Payment History',
          subtitle: 'View past transactions and receipts',
          path: '/wallet',
          color: 'bg-amber-50 text-amber-600',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: Sliders,
          label: 'Delivery Preferences',
          subtitle: 'Default instructions, vehicle & tip',
          path: '/customer/preferences',
          color: 'bg-sky-50 text-sky-600',
        },
        {
          icon: Bell,
          label: 'Notification Settings',
          subtitle: 'Manage alerts and reminders',
          path: '/settings/notifications',
          color: 'bg-orange-50 text-orange-600',
        },
        {
          icon: Globe,
          label: 'Language',
          subtitle: 'Change display language',
          path: '/settings/language',
          color: 'bg-teal-50 text-teal-600',
        },
        {
          icon: Shield,
          label: 'Security',
          subtitle: 'Password and account security',
          path: '/customer/security',
          color: 'bg-gray-100 text-gray-600',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: MessageCircle,
          label: 'Chat Support',
          subtitle: 'Get help from our team',
          path: '/support/chat',
          color: 'bg-blue-50 text-blue-600',
        },
        {
          icon: Megaphone,
          label: 'Announcements',
          subtitle: 'Latest updates and news',
          path: '/announcements',
          color: 'bg-amber-50 text-amber-600',
        },
        {
          icon: Star,
          label: 'Rate MoveMe TT',
          subtitle: 'Share your feedback',
          action: () => alert('Thank you for your interest in rating us!'),
          color: 'bg-yellow-50 text-yellow-600',
        },
      ],
    },
    {
      title: 'Other',
      items: [
        {
          icon: FileText,
          label: 'Terms of Service',
          subtitle: 'View our terms and conditions',
          action: () => setShowTerms(true),
          color: 'bg-slate-50 text-slate-600',
        },
        {
          icon: MoreHorizontal,
          label: 'More',
          subtitle: 'Privacy, about & more',
          path: '/more',
          color: 'bg-gray-100 text-gray-600',
        },
        {
          icon: LogOut,
          label: 'Logout',
          subtitle: 'Sign out of your account',
          action: onLogout,
          color: 'bg-red-50 text-red-500',
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
            <div className="card overflow-hidden">
              {section.items.map((item, index) => {
                const Icon = item.icon;
                const isLast = index === section.items.length - 1;

                return (
                  <button
                    key={item.label}
                    onClick={() => handleItemClick(item)}
                    className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50/80 transition-all text-left group ${
                      !isLast ? 'border-b border-gray-50' : ''
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl ${item.color || 'bg-gray-100 text-gray-600'} flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{item.label}</p>
                      {item.subtitle && (
                        <p className="text-xs text-gray-500 mt-0.5">{item.subtitle}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <TermsOfServiceModal open={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}
