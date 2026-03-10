import { useState } from 'react';
import { ArrowLeft, FileText, Shield, Info, HelpCircle, Star, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TermsOfServiceModal } from '../components/TermsOfServiceModal';

interface MorePageProps {
  onNavigate: (path: string) => void;
}

export function MorePage({ onNavigate }: MorePageProps) {
  const { profile } = useAuth();
  const [showTerms, setShowTerms] = useState(false);

  const getProfilePath = () => {
    if (!profile) return '/';
    if (profile.role === 'customer') return '/customer/profile';
    if (profile.role === 'courier') return '/courier/profile';
    if (profile.role === 'business') {
      return profile.business_type === 'haulage' ? '/courier/profile' : '/business/profile';
    }
    return '/';
  };

  const moreOptions = [
    {
      icon: Info,
      label: 'About MoveMe TT',
      description: 'Learn more about our service',
      iconBg: 'bg-moveme-blue-100',
      iconColor: 'text-moveme-blue-600',
      action: () => onNavigate('/about'),
    },
    {
      icon: FileText,
      label: 'Terms of Service',
      description: 'Read our terms and conditions',
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-600',
      action: () => setShowTerms(true),
    },
    {
      icon: Shield,
      label: 'Privacy Policy',
      description: 'View our privacy policy',
      iconBg: 'bg-moveme-teal-100',
      iconColor: 'text-moveme-teal-600',
      action: () => alert('Privacy Policy coming soon'),
    },
    {
      icon: HelpCircle,
      label: 'Help Center',
      description: 'Get help with common questions',
      iconBg: 'bg-warning-100',
      iconColor: 'text-warning-600',
      action: () => onNavigate('/support'),
    },
    {
      icon: Star,
      label: 'Rate MoveMe TT',
      description: 'Share your feedback',
      iconBg: 'bg-success-100',
      iconColor: 'text-success-600',
      action: () => alert('Thank you for your interest in rating us!'),
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">More</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="card overflow-hidden">
          {moreOptions.map((option, index) => {
            const Icon = option.icon;
            const isLast = index === moreOptions.length - 1;

            return (
              <button
                key={option.label}
                onClick={option.action}
                className={`w-full flex items-center gap-3.5 p-4 hover:bg-gray-50 transition-all text-left group ${
                  !isLast ? 'border-b border-gray-100' : ''
                }`}
              >
                <div className={`w-10 h-10 rounded-xl ${option.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`w-5 h-5 ${option.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 text-sm">{option.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{option.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" />
              </button>
            );
          })}
        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          <p className="font-medium">MoveMe TT v2.0.0</p>
          <p className="mt-1">2024 MoveMe TT. All rights reserved.</p>
        </div>
      </div>

      <TermsOfServiceModal open={showTerms} onClose={() => setShowTerms(false)} />
    </div>
  );
}
