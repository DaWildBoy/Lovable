import { useState, useRef } from 'react';
import { X, Camera, Loader2, CheckCircle2, Clock, ShoppingBag, ClipboardList, Upload, AlertTriangle, Eye, Square, CheckSquare, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MarketplaceInspectionModalProps {
  jobId: string;
  inspectionInstructions: string | null;
  itemScreenshotUrl: string | null;
  inspectionStatus: string | null;
  inspectionPhotoUrl: string | null;
  sellerContact: string | null;
  paymentStatus: string | null;
  requirePhoto: boolean;
  onClose: () => void;
  onStatusUpdate: () => void;
}

const DEFAULT_CHECKLIST = [
  'Item matches the description / listing photo',
  'No visible damage, scratches, or defects',
  'Item is complete with all parts / accessories',
  'Item powers on / functions correctly (if applicable)',
];

export function MarketplaceInspectionModal({
  jobId,
  inspectionInstructions,
  itemScreenshotUrl,
  inspectionStatus,
  inspectionPhotoUrl,
  sellerContact,
  paymentStatus,
  requirePhoto,
  onClose,
  onStatusUpdate,
}: MarketplaceInspectionModalProps) {
  const customInstructions = inspectionInstructions
    ? inspectionInstructions.split('\n').filter(line => line.trim()).map(line => line.replace(/^\d+\.\s*/, '').trim())
    : [];

  const checklistItems = customInstructions.length > 0 ? customInstructions : DEFAULT_CHECKLIST;

  const [checkedItems, setCheckedItems] = useState<Set<number>>(
    inspectionStatus === 'inspection_submitted' || inspectionStatus === 'buyer_approved'
      ? new Set(checklistItems.map((_, i) => i))
      : new Set()
  );
  const [uploading, setUploading] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(inspectionPhotoUrl || null);
  const [submitted, setSubmitted] = useState(inspectionStatus === 'inspection_submitted' || inspectionStatus === 'buyer_approved');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const allChecked = checkedItems.size === checklistItems.length;
  const photoProvided = !!photoFile || !!inspectionPhotoUrl;
  const canSubmit = allChecked && (!requirePhoto || photoProvided);

  const toggleCheck = (index: number) => {
    if (submitted) return;
    setCheckedItems(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleSubmitInspection = async () => {
    if (!allChecked) {
      setError('Please confirm all checklist items before submitting');
      return;
    }
    if (requirePhoto && !photoFile && !inspectionPhotoUrl) {
      setError('The buyer requires a photo of the item. Please take one before submitting.');
      return;
    }

    setUploading(true);
    setError('');

    try {
      let photoUrl = inspectionPhotoUrl;

      if (photoFile) {
        const fileExt = photoFile.name.split('.').pop();
        const filePath = `inspections/${jobId}/inspection-${Date.now()}.${fileExt}`;
        const { error: uploadErr } = await supabase.storage
          .from('marketplace-photos')
          .upload(filePath, photoFile);

        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabase.storage
          .from('marketplace-photos')
          .getPublicUrl(filePath);
        photoUrl = urlData.publicUrl;
      }

      const { error: updateErr } = await supabase
        .from('jobs')
        .update({
          marketplace_inspection_photo_url: photoUrl,
          marketplace_inspection_status: 'inspection_submitted',
        })
        .eq('id', jobId);

      if (updateErr) throw updateErr;

      setSubmitted(true);
      onStatusUpdate();
    } catch (err: any) {
      setError(err.message || 'Failed to submit inspection');
    } finally {
      setUploading(false);
    }
  };

  const isApproved = inspectionStatus === 'buyer_approved';
  const isWaiting = submitted && !isApproved;
  const checkedCount = checkedItems.size;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-sky-600 px-5 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Item Inspection</h2>
              <p className="text-xs text-blue-100">Marketplace Safe-Buy</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {isApproved && (
            <div className="p-4 bg-green-50 border-2 border-green-300 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-green-900 text-base">Buyer Approved</p>
                  <p className="text-sm text-green-700 mt-0.5">You can now collect the item and proceed with delivery.</p>
                </div>
              </div>
            </div>
          )}

          {isWaiting && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 animate-pulse">
                  <Clock className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-amber-900 text-base">Waiting for Buyer Approval</p>
                  <p className="text-sm text-amber-700 mt-0.5">
                    The buyer has been notified. Please wait for their approval before collecting the item.
                  </p>
                </div>
              </div>
            </div>
          )}

          {sellerContact && (
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Seller</p>
              <p className="text-sm font-bold text-gray-900">{sellerContact}</p>
            </div>
          )}

          {paymentStatus && (
            <div className={`p-3.5 rounded-xl border ${
              paymentStatus === 'already_paid'
                ? 'bg-green-50 border-green-200'
                : 'bg-blue-50 border-blue-200'
            }`}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Payment</p>
              <p className={`text-sm font-bold ${
                paymentStatus === 'already_paid' ? 'text-green-800' : 'text-blue-800'
              }`}>
                {paymentStatus === 'already_paid'
                  ? 'Buyer already paid the seller -- just pick up'
                  : 'Buyer will pay seller after they approve your inspection'}
              </p>
            </div>
          )}

          {itemScreenshotUrl && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Item Photo from Buyer</p>
              <img
                src={itemScreenshotUrl}
                alt="Item from listing"
                className="w-full h-48 object-cover rounded-xl border border-gray-200 shadow-sm"
              />
            </div>
          )}

          {!isApproved && !isWaiting && (
            <div className="rounded-xl border-2 border-blue-200 overflow-hidden">
              <div className="bg-blue-50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-bold text-blue-900">Condition Checklist</p>
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                  allChecked
                    ? 'bg-green-100 text-green-700'
                    : 'bg-blue-100 text-blue-700'
                }`}>
                  {checkedCount}/{checklistItems.length}
                </span>
              </div>
              <div className="divide-y divide-gray-100">
                {checklistItems.map((item, i) => {
                  const checked = checkedItems.has(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleCheck(i)}
                      className={`w-full flex items-start gap-3 px-4 py-3.5 text-left transition-all ${
                        checked ? 'bg-green-50' : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {checked ? (
                          <CheckSquare className="w-5 h-5 text-green-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-300" />
                        )}
                      </div>
                      <span className={`text-sm leading-relaxed ${
                        checked ? 'text-green-800 font-medium' : 'text-gray-700'
                      }`}>
                        {item}
                      </span>
                    </button>
                  );
                })}
              </div>
              {allChecked && (
                <div className="px-4 py-2.5 bg-green-50 border-t border-green-200 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-xs font-bold text-green-700">All items confirmed in good condition</span>
                </div>
              )}
            </div>
          )}

          {submitted && (
            <div className="rounded-xl border-2 border-green-200 overflow-hidden">
              <div className="bg-green-50 px-4 py-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <p className="text-sm font-bold text-green-900">Condition Checklist - All Confirmed</p>
              </div>
              <div className="divide-y divide-green-100">
                {checklistItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 px-4 py-3 bg-green-50/50">
                    <CheckSquare className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-green-800 font-medium leading-relaxed">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isApproved && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {submitted
                  ? 'Your Inspection Photo'
                  : requirePhoto
                  ? 'Take a Live Photo of the Item *'
                  : 'Take a Photo of the Item (Optional)'}
              </p>
              {requirePhoto && !submitted && (
                <div className="flex items-center gap-2 mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                  <p className="text-xs text-amber-700 font-medium">Buyer requires a photo before approving</p>
                </div>
              )}
              {photoPreview ? (
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Inspection photo"
                    className="w-full h-56 object-cover rounded-xl border-2 border-blue-300 shadow-sm"
                  />
                  {!submitted && (
                    <button
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                      }}
                      className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : !submitted ? (
                <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-blue-400 rounded-xl cursor-pointer bg-blue-50/50 hover:bg-blue-50 transition-colors">
                  <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                    <Camera className="w-7 h-7 text-blue-600" />
                  </div>
                  <span className="text-sm font-bold text-blue-700">Tap to take photo</span>
                  <span className="text-xs text-gray-500 mt-1">Show the item clearly</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoCapture}
                  />
                </label>
              ) : null}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
            </div>
          )}

          {!submitted && (
            <button
              onClick={handleSubmitInspection}
              disabled={uploading || !canSubmit}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-sky-600 hover:from-blue-700 hover:to-sky-700 text-white rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-600/20 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Uploading...
                </>
              ) : !allChecked ? (
                <>
                  <ClipboardList className="w-5 h-5" />
                  Complete All Checklist Items First
                </>
              ) : requirePhoto && !photoProvided ? (
                <>
                  <Camera className="w-5 h-5" />
                  Photo Required Before Submitting
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Submit Inspection - Send to Buyer
                </>
              )}
            </button>
          )}

          {isApproved && (
            <button
              onClick={onClose}
              className="w-full py-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold text-base transition-all flex items-center justify-center gap-3 shadow-lg active:scale-[0.98]"
            >
              <CheckCircle2 className="w-5 h-5" />
              Proceed to Collect Item
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
