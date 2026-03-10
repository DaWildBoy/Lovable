import { useState } from 'react';
import { Bike, ShoppingBag, Trash2, Package, ChevronRight } from 'lucide-react';

export type JobType = 'standard' | 'courier' | 'marketplace_safebuy' | 'junk_removal';

interface JobTypeOption {
  id: JobType;
  label: string;
  tagline: string;
  description: string;
  icon: React.ReactNode;
  accentColor: string;
  bgGradient: string;
  borderColor: string;
  badgeText?: string;
  badgeColor?: string;
  features: string[];
}

const JOB_TYPES: JobTypeOption[] = [
  {
    id: 'standard',
    label: 'Standard Delivery',
    tagline: 'Moving & general hauling',
    description: 'The classic. Moving furniture, large items, or anything that needs a truck or van. Set your pickup and dropoff, describe your cargo, and get matched with a driver.',
    icon: <Package className="w-7 h-7" />,
    accentColor: 'text-blue-600',
    bgGradient: 'from-blue-50 to-slate-50',
    borderColor: 'border-blue-200 hover:border-blue-400',
    badgeText: 'Most Popular',
    badgeColor: 'bg-blue-100 text-blue-700',
    features: ['Trucks & vans available', 'Heavy items welcome', 'Full cargo details'],
  },
  {
    id: 'courier',
    label: 'Courier Mode',
    tagline: 'Quick runs, small items',
    description: 'Need something picked up and dropped off fast? Perfect for documents, keys, small packages, and anything that fits on a bike or in a sedan.',
    icon: <Bike className="w-7 h-7" />,
    accentColor: 'text-teal-600',
    bgGradient: 'from-teal-50 to-emerald-50',
    borderColor: 'border-teal-200 hover:border-teal-400',
    features: ['Moto & sedan drivers', 'Fastest delivery option', '$30 - $50 TTD typical'],
  },
  {
    id: 'marketplace_safebuy',
    label: 'Marketplace Safe-Buy',
    tagline: 'Inspect & collect for you',
    description: 'Buying something off Facebook Marketplace or a classifieds site? Our driver goes to the seller, video-calls you to inspect the item, and brings it to you safely.',
    icon: <ShoppingBag className="w-7 h-7" />,
    accentColor: 'text-blue-600',
    bgGradient: 'from-blue-50 to-sky-50',
    borderColor: 'border-blue-200 hover:border-blue-400',
    badgeText: 'Stay Safe',
    badgeColor: 'bg-blue-100 text-blue-700',
    features: ['Video call inspection', 'No meeting strangers', 'Driver handles the pickup'],
  },
  {
    id: 'junk_removal',
    label: 'Junk Removal',
    tagline: 'We haul it to the dump',
    description: 'Got an old appliance, broken furniture, or junk you need gone? We pick it up and take it to the nearest official landfill. Eco-friendly disposal with photo proof.',
    icon: <Trash2 className="w-7 h-7" />,
    accentColor: 'text-amber-600',
    bgGradient: 'from-amber-50 to-orange-50',
    borderColor: 'border-amber-200 hover:border-amber-400',
    features: ['Auto-routed to landfill', 'Tipping fee included', 'Photo proof of disposal'],
  },
];

interface JobTypeSelectorProps {
  selectedType: JobType;
  onSelect: (type: JobType) => void;
  onContinue: () => void;
}

export function JobTypeSelector({ selectedType, onSelect, onContinue }: JobTypeSelectorProps) {
  const [hoveredType, setHoveredType] = useState<JobType | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg sm:text-xl font-bold text-gray-900">What do you need?</h2>
        <p className="text-sm text-gray-500 mt-1">Choose the type of service that best fits your needs</p>
      </div>

      <div className="space-y-3">
        {JOB_TYPES.map((type) => {
          const isSelected = selectedType === type.id;
          const isHovered = hoveredType === type.id;

          return (
            <button
              key={type.id}
              onClick={() => onSelect(type.id)}
              onMouseEnter={() => setHoveredType(type.id)}
              onMouseLeave={() => setHoveredType(null)}
              className={`
                w-full text-left rounded-xl border-2 transition-all duration-200 overflow-hidden
                ${isSelected
                  ? `${type.borderColor.split(' ')[0].replace('border-', 'border-').replace('-200', '-500')} ring-2 ring-offset-1 ${type.borderColor.split(' ')[0].replace('border-', 'ring-').replace('-200', '-200')} shadow-md`
                  : `${type.borderColor} shadow-sm`
                }
                ${isHovered && !isSelected ? 'shadow-md -translate-y-0.5' : ''}
              `}
            >
              <div className={`p-4 bg-gradient-to-r ${isSelected ? type.bgGradient : 'from-white to-white'} transition-all duration-200`}>
                <div className="flex items-start gap-4">
                  <div className={`
                    flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200
                    ${isSelected
                      ? `bg-gradient-to-br ${type.bgGradient} ${type.accentColor} shadow-sm`
                      : `bg-gray-100 text-gray-400 ${isHovered ? type.accentColor : ''}`
                    }
                  `}>
                    {type.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className={`font-semibold text-base ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                        {type.label}
                      </h3>
                      {type.badgeText && (
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${type.badgeColor}`}>
                          {type.badgeText}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-0.5 ${isSelected ? 'text-gray-600' : 'text-gray-500'}`}>
                      {type.tagline}
                    </p>

                    <div className={`
                      overflow-hidden transition-all duration-300 ease-in-out
                      ${isSelected ? 'max-h-40 opacity-100 mt-3' : 'max-h-0 opacity-0 mt-0'}
                    `}>
                      <p className="text-sm text-gray-600 leading-relaxed mb-3">
                        {type.description}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {type.features.map((feature, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 text-xs font-medium text-gray-600 bg-white/80 border border-gray-200 rounded-full px-2.5 py-1"
                          >
                            <span className={`w-1 h-1 rounded-full ${type.accentColor.replace('text-', 'bg-')}`} />
                            {feature}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className={`
                    flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 mt-1
                    ${isSelected
                      ? `${type.borderColor.split(' ')[0].replace('border-', 'border-').replace('-200', '-500')} ${type.accentColor.replace('text-', 'bg-')}`
                      : 'border-gray-300'
                    }
                  `}>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-white" />
                    )}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <button
        onClick={onContinue}
        className="w-full mt-4 flex items-center justify-center gap-2 bg-gray-900 text-white font-semibold py-3.5 px-6 rounded-xl hover:bg-gray-800 active:scale-[0.98] transition-all duration-150 shadow-lg shadow-gray-900/10"
      >
        Continue
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}
