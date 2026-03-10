import { Package, Truck, Building2, Check } from 'lucide-react';

interface RoleSelectionProps {
  selectedRole: string | null;
  onSelectRole: (role: string) => void;
}

export function RoleSelection({ selectedRole, onSelectRole }: RoleSelectionProps) {
  const roles = [
    {
      id: 'customer',
      title: 'Customer',
      description: 'I need to move items',
      icon: Package,
      accent: 'bg-moveme-blue-50 text-moveme-blue-600 border-moveme-blue-200',
      selectedBg: 'bg-moveme-blue-50 border-moveme-blue-500 ring-2 ring-moveme-blue-500/20',
      iconBg: 'bg-moveme-blue-100',
    },
    {
      id: 'courier',
      title: 'Courier / Driver',
      description: 'I want to earn delivering',
      icon: Truck,
      accent: 'bg-moveme-teal-50 text-moveme-teal-600 border-moveme-teal-200',
      selectedBg: 'bg-moveme-teal-50 border-moveme-teal-500 ring-2 ring-moveme-teal-500/20',
      iconBg: 'bg-moveme-teal-100',
    },
    {
      id: 'business',
      title: 'Business',
      description: 'I run a retail or haulage company',
      icon: Building2,
      accent: 'bg-warning-50 text-warning-600 border-warning-200',
      selectedBg: 'bg-warning-50 border-warning-500 ring-2 ring-warning-500/20',
      iconBg: 'bg-warning-100',
    }
  ];

  return (
    <div>
      <div className="text-center mb-6">
        <h2 className="text-xl font-bold text-gray-900 tracking-tight">How will you use MoveMe TT?</h2>
        <p className="text-gray-500 text-sm mt-1">Select your account type</p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        {roles.map((role) => {
          const Icon = role.icon;
          const isSelected = selectedRole === role.id;

          return (
            <button
              key={role.id}
              onClick={() => onSelectRole(role.id)}
              className={`relative p-5 rounded-2xl border-2 transition-all duration-200 text-left ${
                isSelected
                  ? role.selectedBg
                  : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-soft'
              }`}
            >
              <div className={`inline-flex p-3 rounded-xl ${role.iconBg} mb-3`}>
                <Icon className={`w-6 h-6 ${isSelected ? 'text-gray-900' : 'text-gray-600'}`} />
              </div>
              <h3 className="text-base font-bold text-gray-900 mb-1">{role.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">{role.description}</p>

              {isSelected && (
                <div className="absolute top-3 right-3 w-6 h-6 bg-moveme-blue-600 rounded-full flex items-center justify-center animate-scale-in shadow-sm">
                  <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
