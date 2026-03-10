import { User, Phone, Building2, PenLine } from 'lucide-react';

interface CourierHandoverFormProps {
  recipientName: string;
  recipientPhone: string;
  buildingDetails: string;
  requireSignature: boolean;
  onRecipientNameChange: (value: string) => void;
  onRecipientPhoneChange: (value: string) => void;
  onBuildingDetailsChange: (value: string) => void;
  onRequireSignatureChange: (value: boolean) => void;
  errors?: {
    recipientName?: string;
    recipientPhone?: string;
  };
}

export function CourierHandoverForm({
  recipientName,
  recipientPhone,
  buildingDetails,
  requireSignature,
  onRecipientNameChange,
  onRecipientPhoneChange,
  onBuildingDetailsChange,
  onRequireSignatureChange,
  errors,
}: CourierHandoverFormProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-bold text-gray-900">Handover Details</h3>
        <p className="text-xs text-gray-500 mt-0.5">Who should the driver hand this to at the dropoff?</p>
      </div>

      <div className="space-y-3 bg-white rounded-xl border border-gray-200 p-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
            <User className="w-3.5 h-3.5 text-gray-400" />
            Recipient Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => onRecipientNameChange(e.target.value)}
            placeholder="Full name of the person receiving"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              errors?.recipientName
                ? 'border-red-300 focus:ring-red-200 bg-red-50'
                : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
            }`}
          />
          {errors?.recipientName && (
            <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.recipientName}</p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            Recipient Phone <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={recipientPhone}
            onChange={(e) => onRecipientPhoneChange(e.target.value)}
            placeholder="e.g. 868-555-1234"
            className={`w-full px-3.5 py-2.5 text-sm rounded-lg border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              errors?.recipientPhone
                ? 'border-red-300 focus:ring-red-200 bg-red-50'
                : 'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
            }`}
          />
          {errors?.recipientPhone && (
            <p className="text-[11px] text-red-600 mt-1 font-medium">{errors.recipientPhone}</p>
          )}
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            Building / Floor / Unit
          </label>
          <input
            type="text"
            value={buildingDetails}
            onChange={(e) => onBuildingDetailsChange(e.target.value)}
            placeholder="e.g. Tower B, 3rd Floor, Unit 305"
            className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-200 focus:border-blue-400 transition-colors"
          />
          <p className="text-[10px] text-gray-400 mt-1">Helps the driver find the exact location</p>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => onRequireSignatureChange(!requireSignature)}
            className={`
              w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all duration-200
              ${requireSignature
                ? 'border-teal-400 bg-teal-50'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
              }
            `}
          >
            <div className={`
              w-8 h-8 rounded-lg flex items-center justify-center transition-colors
              ${requireSignature ? 'bg-teal-100 text-teal-600' : 'bg-gray-200 text-gray-400'}
            `}>
              <PenLine className="w-4 h-4" />
            </div>
            <div className="flex-1 text-left">
              <p className={`text-sm font-semibold ${requireSignature ? 'text-teal-800' : 'text-gray-700'}`}>
                Require Signature
              </p>
              <p className="text-[11px] text-gray-500">Recipient must sign on the driver's device</p>
            </div>
            <div className={`
              w-10 h-6 rounded-full transition-all duration-200 relative
              ${requireSignature ? 'bg-teal-500' : 'bg-gray-300'}
            `}>
              <div className={`
                w-4.5 h-4.5 bg-white rounded-full shadow-sm absolute top-0.5 transition-all duration-200
                ${requireSignature ? 'right-0.5' : 'left-0.5'}
              `} style={{ width: 20, height: 20 }} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
