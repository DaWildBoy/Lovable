import { useState } from 'react';
import { X, AlertTriangle, RotateCcw, Loader2, PackageX, DoorOpen, MapPinOff, ShieldAlert } from 'lucide-react';

const RETURN_REASONS = [
  {
    key: 'customer_refused',
    label: 'Customer Refused Item',
    icon: PackageX,
    description: 'The customer does not want the delivery',
  },
  {
    key: 'item_does_not_fit',
    label: 'Item Does Not Fit',
    icon: DoorOpen,
    description: 'Item cannot fit through door or space',
  },
  {
    key: 'wrong_address_unavailable',
    label: 'Wrong Address / Customer Unavailable',
    icon: MapPinOff,
    description: 'Nobody at location or address is incorrect',
  },
  {
    key: 'item_damaged',
    label: 'Item Damaged',
    icon: ShieldAlert,
    description: 'Item was found damaged on arrival',
  },
] as const;

export type ReturnReason = typeof RETURN_REASONS[number]['key'];

interface ReturnItemModalProps {
  jobId: string;
  originalFare: number;
  pickupLocation: string;
  hideFinancial?: boolean;
  onConfirm: (reason: ReturnReason, notes: string) => Promise<void>;
  onClose: () => void;
}

export function ReturnItemModal({ originalFare, pickupLocation, hideFinancial, onConfirm, onClose }: ReturnItemModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReturnReason | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const returnFee = Math.round(originalFare * 0.5);

  const handleConfirm = async () => {
    if (!selectedReason) return;
    setSubmitting(true);
    try {
      await onConfirm(selectedReason, notes);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 pt-5 pb-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Delivery Failed</h2>
                <p className="text-xs text-gray-500">Why is the item returning?</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div className="space-y-2">
            {RETURN_REASONS.map((reason) => {
              const Icon = reason.icon;
              const isSelected = selectedReason === reason.key;
              return (
                <button
                  key={reason.key}
                  onClick={() => setSelectedReason(reason.key)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
                    isSelected
                      ? 'border-red-500 bg-red-50 shadow-sm'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      isSelected ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`font-semibold text-sm ${isSelected ? 'text-red-900' : 'text-gray-900'}`}>
                        {reason.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${isSelected ? 'text-red-600' : 'text-gray-500'}`}>
                        {reason.description}
                      </p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                      isSelected ? 'border-red-500 bg-red-500' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-white" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div>
            <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
              Additional Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Doorframe too narrow, customer not answering phone..."
              rows={2}
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all resize-none placeholder:text-gray-400"
            />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-900">Return Trip Details</p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-amber-700">Return to:</span>
                    <span className="text-amber-900 font-medium text-right max-w-[60%] truncate">{pickupLocation}</span>
                  </div>
                  {!hideFinancial && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-700">Base transport cost:</span>
                        <span className="text-amber-900 font-medium">TTD ${originalFare.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-amber-700">Platform fee on return:</span>
                        <span className="text-green-700 font-semibold">$0.00 (Waived)</span>
                      </div>
                      <div className="h-px bg-amber-200 my-1" />
                      <div className="flex justify-between text-sm">
                        <span className="text-amber-800 font-semibold">Return fee (50%):</span>
                        <span className="text-amber-900 font-bold">TTD ${returnFee.toLocaleString()}</span>
                      </div>
                    </>
                  )}
                </div>
                {!hideFinancial && (
                  <>
                    <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                      <p className="text-[11px] text-green-800 leading-relaxed">
                        <span className="font-bold">MoveMeTT Goodwill:</span> Platform fees are waived on return trips. You keep 100% of the return fee (TTD ${returnFee.toLocaleString()}).
                      </p>
                    </div>
                    <p className="text-[11px] text-amber-600 mt-2">
                      This fee will be added to the invoice and your earnings.
                    </p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4 space-y-2">
          <button
            onClick={handleConfirm}
            disabled={!selectedReason || submitting}
            className="w-full py-4 rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-lg shadow-red-600/20"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Initiating Return...</span>
              </>
            ) : (
              <>
                <RotateCcw className="w-5 h-5" />
                <span>Confirm Return Trip</span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
