import { Clock, Zap } from 'lucide-react';

export type CourierUrgency = 'standard' | 'express';

interface UrgencyOption {
  id: CourierUrgency;
  label: string;
  subtitle: string;
  window: string;
  icon: React.ReactNode;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  selectedBorder: string;
  multiplier: number;
  badge?: string;
  badgeColor?: string;
}

const URGENCY_OPTIONS: UrgencyOption[] = [
  {
    id: 'standard',
    label: 'Standard',
    subtitle: 'Delivered within 4 hours',
    window: '4 hr window',
    icon: <Clock className="w-5 h-5" />,
    accentColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-gray-200 hover:border-blue-300',
    selectedBorder: 'border-blue-500 ring-2 ring-blue-100',
    multiplier: 1.0,
  },
  {
    id: 'express',
    label: 'Express Rush',
    subtitle: 'Priority matching, fastest driver',
    window: 'ASAP',
    icon: <Zap className="w-5 h-5" />,
    accentColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-gray-200 hover:border-amber-300',
    selectedBorder: 'border-amber-500 ring-2 ring-amber-100',
    multiplier: 1.5,
    badge: '1.5x',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
];

interface CourierUrgencySelectorProps {
  selected: CourierUrgency;
  onSelect: (urgency: CourierUrgency) => void;
  basePrice: number | null;
}

export function CourierUrgencySelector({ selected, onSelect, basePrice }: CourierUrgencySelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-900">How fast do you need it?</h3>
        <p className="text-xs text-gray-500 mt-0.5">Express gets you priority driver matching</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {URGENCY_OPTIONS.map((option) => {
          const isSelected = selected === option.id;
          const estimatedPrice = basePrice && option.multiplier > 1
            ? Math.round(basePrice * option.multiplier)
            : null;

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`
                relative text-left rounded-xl border-2 transition-all duration-200 overflow-hidden
                ${isSelected ? option.selectedBorder : option.borderColor}
                ${isSelected ? 'shadow-md' : 'shadow-sm hover:shadow-md'}
              `}
            >
              <div className={`p-3.5 ${isSelected ? option.bgColor : 'bg-white'} transition-colors duration-200`}>
                <div className="flex items-start justify-between mb-2">
                  <div className={`
                    w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200
                    ${isSelected ? `${option.bgColor} ${option.accentColor}` : 'bg-gray-100 text-gray-400'}
                  `}>
                    {option.icon}
                  </div>

                  {option.badge && (
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${option.badgeColor}`}>
                      {option.badge}
                    </span>
                  )}
                </div>

                <h4 className={`font-semibold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-700'}`}>
                  {option.label}
                </h4>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-tight">{option.subtitle}</p>

                <div className="mt-2 pt-2 border-t border-black/5">
                  <span className={`text-xs font-bold ${isSelected ? option.accentColor : 'text-gray-500'}`}>
                    {option.window}
                  </span>
                  {estimatedPrice && isSelected && (
                    <p className="text-[10px] text-amber-600 font-medium mt-0.5">
                      ~${estimatedPrice} TTD
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {selected === 'express' && (
        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <Zap className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Express Rush applies a <span className="font-bold">1.5x multiplier</span> to the base fare.
            Your delivery gets priority matching with the nearest available driver.
          </p>
        </div>
      )}
    </div>
  );
}
