import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface CourierSafetyCheckboxProps {
  acknowledged: boolean;
  onAcknowledgeChange: (value: boolean) => void;
  error?: string;
}

export function CourierSafetyCheckbox({
  acknowledged,
  onAcknowledgeChange,
  error,
}: CourierSafetyCheckboxProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => onAcknowledgeChange(!acknowledged)}
        className={`
          w-full rounded-xl border-2 transition-all duration-200 overflow-hidden
          ${acknowledged
            ? 'border-teal-400 shadow-md'
            : error
            ? 'border-red-300 shadow-sm'
            : 'border-gray-200 shadow-sm hover:border-gray-300'
          }
        `}
      >
        <div className={`p-4 ${acknowledged ? 'bg-teal-50' : 'bg-white'} transition-colors duration-200`}>
          <div className="flex items-start gap-3">
            <div className={`
              flex-shrink-0 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 mt-0.5
              ${acknowledged
                ? 'bg-teal-500 border-teal-500'
                : error
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300'
              }
            `}>
              {acknowledged && <ShieldCheck className="w-4 h-4 text-white" />}
            </div>

            <div className="flex-1 text-left">
              <p className={`text-sm font-semibold ${acknowledged ? 'text-teal-900' : 'text-gray-900'}`}>
                Safety & Liability Acknowledgement
              </p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                I confirm this package contains no prohibited, hazardous, illegal, or perishable items.
                I understand the driver is not liable for pre-existing damage and that standard courier
                insurance covers up to <span className="font-semibold">$500 TTD</span>.
              </p>
            </div>
          </div>
        </div>
      </button>

      {error && (
        <div className="flex items-center gap-1.5 px-2">
          <AlertTriangle className="w-3 h-3 text-red-500" />
          <p className="text-[11px] text-red-600 font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
