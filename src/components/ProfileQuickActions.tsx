import { Wallet, CreditCard, MessageCircle, Bell } from 'lucide-react';

interface ProfileQuickActionsProps {
  onNavigate: (path: string) => void;
  hideFinancial?: boolean;
}

export function ProfileQuickActions({ onNavigate, hideFinancial }: ProfileQuickActionsProps) {
  const allActions = [
    {
      icon: Wallet,
      label: 'Wallet',
      path: '/wallet',
      color: 'bg-green-100 text-green-600',
      financial: true,
    },
    {
      icon: CreditCard,
      label: 'Cards',
      path: '/payment-methods',
      color: 'bg-blue-100 text-blue-600',
      financial: true,
    },
    {
      icon: MessageCircle,
      label: 'Support',
      path: '/support',
      color: 'bg-teal-100 text-teal-600',
      financial: false,
    },
    {
      icon: Bell,
      label: 'Notifications',
      path: '/notifications',
      color: 'bg-orange-100 text-orange-600',
      financial: false,
    },
  ];

  const quickActions = hideFinancial
    ? allActions.filter((a) => !a.financial)
    : allActions;

  return (
    <div className="px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className={`grid grid-cols-${quickActions.length} gap-3`}>
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.path}
                onClick={() => onNavigate(action.path)}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all border border-gray-100"
              >
                <div className={`w-12 h-12 rounded-full ${action.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-gray-700">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
