import { Mail, Package, Box, Bike, Car, Check } from 'lucide-react';

export type CourierCargoSize = 'envelope' | 'small_parcel' | 'medium_box';

interface CargoOption {
  id: CourierCargoSize;
  label: string;
  description: string;
  examples: string;
  icon: React.ReactNode;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  selectedBorder: string;
  fleetNote: string;
  fleetIcon: React.ReactNode;
}

const CARGO_OPTIONS: CargoOption[] = [
  {
    id: 'envelope',
    label: 'Envelope',
    description: 'Flat items that fit in a large envelope or folder',
    examples: 'Documents, keys, cards, small electronics',
    icon: <Mail className="w-6 h-6" />,
    accentColor: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-gray-200 hover:border-teal-300',
    selectedBorder: 'border-teal-500 ring-2 ring-teal-100',
    fleetNote: 'Moto or sedan',
    fleetIcon: <Bike className="w-3.5 h-3.5" />,
  },
  {
    id: 'small_parcel',
    label: 'Small Parcel',
    description: 'Fits in a backpack or can be carried with one hand',
    examples: 'Shoeboxes, takeaway bags, small gadgets',
    icon: <Package className="w-6 h-6" />,
    accentColor: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-gray-200 hover:border-blue-300',
    selectedBorder: 'border-blue-500 ring-2 ring-blue-100',
    fleetNote: 'Moto or sedan',
    fleetIcon: <Bike className="w-3.5 h-3.5" />,
  },
  {
    id: 'medium_box',
    label: 'Medium Box',
    description: 'Needs a car seat or trunk space',
    examples: 'Monitor, microwave, stack of files, gift basket',
    icon: <Box className="w-6 h-6" />,
    accentColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    borderColor: 'border-gray-200 hover:border-amber-300',
    selectedBorder: 'border-amber-500 ring-2 ring-amber-100',
    fleetNote: 'Sedan only',
    fleetIcon: <Car className="w-3.5 h-3.5" />,
  },
];

interface CourierCargoSelectorProps {
  selected: CourierCargoSize | null;
  onSelect: (size: CourierCargoSize) => void;
}

export function CourierCargoSelector({ selected, onSelect }: CourierCargoSelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-900">What are you sending?</h3>
        <p className="text-xs text-gray-500 mt-0.5">This helps us match you with the right driver</p>
      </div>

      <div className="space-y-2.5">
        {CARGO_OPTIONS.map((option) => {
          const isSelected = selected === option.id;

          return (
            <button
              key={option.id}
              onClick={() => onSelect(option.id)}
              className={`
                w-full text-left rounded-xl border-2 transition-all duration-200 overflow-hidden
                ${isSelected ? option.selectedBorder : option.borderColor}
                ${isSelected ? 'shadow-md' : 'shadow-sm hover:shadow-md'}
              `}
            >
              <div className={`p-4 ${isSelected ? `bg-gradient-to-r ${option.bgColor} to-white` : 'bg-white'} transition-colors duration-200`}>
                <div className="flex items-start gap-3.5">
                  <div className={`
                    flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200
                    ${isSelected ? `${option.bgColor} ${option.accentColor}` : 'bg-gray-100 text-gray-400'}
                  `}>
                    {option.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-semibold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                        {option.label}
                      </h4>
                      <span className={`
                        inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full
                        ${isSelected ? `${option.bgColor} ${option.accentColor}` : 'bg-gray-100 text-gray-500'}
                      `}>
                        {option.fleetIcon}
                        {option.fleetNote}
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 mt-0.5">{option.description}</p>
                    <p className="text-[11px] text-gray-400 mt-1 italic">{option.examples}</p>
                  </div>

                  <div className={`
                    flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 mt-0.5
                    ${isSelected
                      ? `${option.selectedBorder.split(' ')[0]} ${option.accentColor.replace('text-', 'bg-')}`
                      : 'border-gray-300'
                    }
                  `}>
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
