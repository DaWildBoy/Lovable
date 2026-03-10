import { ArrowLeft, MessageCircle, HelpCircle, Mail, Phone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface SupportPageProps {
  onNavigate: (path: string) => void;
}

export function SupportPage({ onNavigate }: SupportPageProps) {
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

  const supportOptions = [
    {
      icon: MessageCircle,
      title: 'Chat Support',
      description: 'Get instant AI help or talk to our team',
      action: () => onNavigate('/support/chat'),
      color: 'bg-blue-100 text-blue-600',
    },
    {
      icon: HelpCircle,
      title: 'FAQ',
      description: 'Find answers to common questions',
      action: () => alert('FAQ coming soon'),
      color: 'bg-green-100 text-green-600',
    },
    {
      icon: Mail,
      title: 'Email Support',
      description: 'support@moveme.tt',
      action: () => (window.location.href = 'mailto:support@moveme.tt'),
      color: 'bg-purple-100 text-purple-600',
    },
    {
      icon: Phone,
      title: 'Phone Support',
      description: '+1 (868) 123-4567',
      action: () => (window.location.href = 'tel:+18681234567'),
      color: 'bg-orange-100 text-orange-600',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate(getProfilePath())}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Profile
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="text-sm text-gray-600 mt-1">How can we help you today?</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          {supportOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.title}
                onClick={option.action}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-all text-left"
              >
                <div className="flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-full ${option.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 mb-1">{option.title}</h3>
                    <p className="text-sm text-gray-600">{option.description}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
