import { ArrowLeft, Sliders, MessageCircle, Megaphone, Info, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SettingsMainPageProps {
  onNavigate: (path: string) => void;
}

export function SettingsMainPage({ onNavigate }: SettingsMainPageProps) {
  const { profile } = useAuth();

  const getProfilePath = () => {
    if (!profile) return '/';
    if (profile.role === 'customer') return '/customer/profile';
    if (profile.role === 'courier') return '/courier/profile';
    if (profile.role === 'business') {
      return profile.business_type === 'haulage' ? '/courier/profile' : '/business/profile';
    }
    return '/';
  };

  const settingsCards = [
    {
      icon: Sliders,
      label: 'Preferences',
      description: 'Configure app settings',
      iconBg: 'bg-moveme-blue-100',
      iconColor: 'text-moveme-blue-600',
      action: () => onNavigate('/settings/notifications'),
    },
    {
      icon: MessageCircle,
      label: 'Help & Support',
      description: 'Get help from our team',
      iconBg: 'bg-success-100',
      iconColor: 'text-success-600',
      action: () => onNavigate('/support'),
    },
    {
      icon: Megaphone,
      label: 'Announcements',
      description: 'News and system alerts',
      iconBg: 'bg-warning-100',
      iconColor: 'text-warning-600',
      action: () => onNavigate('/announcements'),
    },
    {
      icon: Info,
      label: 'About',
      description: 'Version 2.0',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      action: () => {},
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 animate-fade-in-up">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate(getProfilePath())}
            className="flex items-center gap-1.5 text-moveme-blue-600 hover:text-moveme-blue-700 font-medium mb-3 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Settings</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {settingsCards.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={item.action}
                className="card-hover p-4 flex items-center gap-3.5 text-left group"
              >
                <div className={`w-11 h-11 ${item.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${item.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-gray-900">{item.label}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
