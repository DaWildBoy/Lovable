import { useState } from 'react';
import { X, CheckCircle2, XCircle, Loader2, Camera, AlertTriangle, CheckSquare, ClipboardList } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MarketplaceBuyerApprovalProps {
  jobId: string;
  inspectionPhotoUrl: string;
  inspectionInstructions: string | null;
  onClose: () => void;
  onStatusUpdate: () => void;
}

export function MarketplaceBuyerApproval({
  jobId,
  inspectionPhotoUrl,
  inspectionInstructions,
  onClose,
  onStatusUpdate,
}: MarketplaceBuyerApprovalProps) {
  const [processing, setProcessing] = useState(false);
  const [decision, setDecision] = useState<'approved' | 'rejected' | null>(null);

  const instructions = inspectionInstructions
    ? inspectionInstructions.split('\n').filter(line => line.trim())
    : [];

  const handleDecision = async (approve: boolean) => {
    setProcessing(true);
    try {
      const status = approve ? 'buyer_approved' : 'buyer_rejected';
      const { error } = await supabase
        .from('jobs')
        .update({
          marketplace_inspection_status: status,
          ...(approve ? { marketplace_buyer_approved_at: new Date().toISOString() } : {}),
        })
        .eq('id', jobId);

      if (error) throw error;
      setDecision(approve ? 'approved' : 'rejected');
      onStatusUpdate();
    } catch (err) {
      console.error('Failed to update inspection status:', err);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-sky-600 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Camera className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Inspection Photo</h2>
              <p className="text-xs text-blue-100">Driver is at the seller's location</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {decision === 'approved' && (
            <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
                <div>
                  <p className="font-bold text-green-900">Approved!</p>
                  <p className="text-sm text-green-700">The driver will now collect your item. Complete your payment to the seller if you haven't already.</p>
                </div>
              </div>
            </div>
          )}

          {decision === 'rejected' && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-xl">
              <div className="flex items-center gap-3">
                <XCircle className="w-8 h-8 text-red-600" />
                <div>
                  <p className="font-bold text-red-900">Rejected</p>
                  <p className="text-sm text-red-700">The driver has been notified. The item will not be collected.</p>
                </div>
              </div>
            </div>
          )}

          {inspectionPhotoUrl && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Driver's Photo of the Item</p>
              <img
                src={inspectionPhotoUrl}
                alt="Inspection photo from driver"
                className="w-full h-64 object-cover rounded-xl border-2 border-gray-200 shadow-sm"
              />
            </div>
          )}

          <div className="rounded-xl border-2 border-green-200 overflow-hidden">
            <div className="bg-green-50 px-4 py-3 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-green-600" />
              <p className="text-sm font-bold text-green-900">Driver Confirmed All Items</p>
            </div>
            <div className="divide-y divide-green-100">
              {instructions.length > 0 ? instructions.map((instruction, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-3 bg-green-50/50">
                  <CheckSquare className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-green-800 font-medium">{instruction.replace(/^\d+\.\s*/, '')}</p>
                </div>
              )) : (
                <>
                  <div className="flex items-start gap-3 px-4 py-3 bg-green-50/50">
                    <CheckSquare className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-green-800 font-medium">Item matches the description / listing photo</p>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3 bg-green-50/50">
                    <CheckSquare className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-green-800 font-medium">No visible damage, scratches, or defects</p>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3 bg-green-50/50">
                    <CheckSquare className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-green-800 font-medium">Item is complete with all parts / accessories</p>
                  </div>
                  <div className="flex items-start gap-3 px-4 py-3 bg-green-50/50">
                    <CheckSquare className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-green-800 font-medium">Item powers on / functions correctly (if applicable)</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {!decision && (
            <>
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800">
                    Review the photo carefully. Once approved, the driver will collect the item and deliver it to you.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => handleDecision(false)}
                  disabled={processing}
                  className="flex-1 py-4 bg-white border-2 border-red-300 hover:border-red-500 hover:bg-red-50 text-red-700 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-5 h-5" />}
                  Reject
                </button>
                <button
                  onClick={() => handleDecision(true)}
                  disabled={processing}
                  className="flex-[2] py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 shadow-lg shadow-green-600/20 active:scale-[0.98] disabled:opacity-50"
                >
                  {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  Approve & Collect
                </button>
              </div>
            </>
          )}

          {decision && (
            <button
              onClick={onClose}
              className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold text-sm transition-colors active:scale-[0.98]"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
