import React, { useState } from 'react';
import { X, Camera, FileSignature, CheckCircle2 } from 'lucide-react';
import { PhotoCapture } from './PhotoCapture';
import { SignatureCanvas } from './SignatureCanvas';
import { supabase } from '../lib/supabase';

interface DeliveryProofModalProps {
  jobId: string;
  cargoItemId: string;
  cargoDescription: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function DeliveryProofModal({
  jobId,
  cargoItemId,
  cargoDescription,
  onComplete,
  onCancel
}: DeliveryProofModalProps) {
  const [showPhotoCapture, setShowPhotoCapture] = useState(false);
  const [showSignatureCapture, setShowSignatureCapture] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [recipientName, setRecipientName] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePhotoCapture = (file: File) => {
    setPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
    setShowPhotoCapture(false);
  };

  const handleSignatureSave = (dataUrl: string) => {
    setSignature(dataUrl);
    setShowSignatureCapture(false);
  };

  const dataUrlToFile = (dataUrl: string, filename: string): File => {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  };

  const handleSubmit = async () => {
    if (!signature) {
      setError('Recipient signature is required');
      return;
    }

    if (!recipientName.trim()) {
      setError('Recipient name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let photoUrl: string | null = null;
      let signatureUrl: string | null = null;

      if (photo) {
        const photoPath = `${jobId}/${cargoItemId}/photo-${Date.now()}.${photo.name.split('.').pop()}`;
        const { error: photoError } = await supabase.storage
          .from('delivery-proofs')
          .upload(photoPath, photo);

        if (photoError) throw photoError;

        const { data: { publicUrl } } = supabase.storage
          .from('delivery-proofs')
          .getPublicUrl(photoPath);

        photoUrl = photoPath;
      }

      const signatureFile = dataUrlToFile(signature, 'signature.png');
      const signaturePath = `${jobId}/${cargoItemId}/signature-${Date.now()}.png`;
      const { error: signatureError } = await supabase.storage
        .from('delivery-proofs')
        .upload(signaturePath, signatureFile);

      if (signatureError) throw signatureError;

      signatureUrl = signaturePath;

      const { error: updateError } = await supabase
        .from('cargo_items')
        .update({
          delivery_proof_photo_url: photoUrl,
          delivery_signature_url: signatureUrl,
          delivered_to_name: recipientName.trim(),
          delivered_at: new Date().toISOString(),
          delivery_notes_from_courier: notes.trim() || null,
          status: 'delivered'
        })
        .eq('id', cargoItemId);

      if (updateError) throw updateError;

      onComplete();
    } catch (err: any) {
      console.error('Error submitting delivery proof:', err);
      setError(err.message || 'Failed to submit delivery proof');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (showPhotoCapture) {
    return (
      <PhotoCapture
        title="Delivery Photo"
        description="Take a photo of the delivered cargo"
        onCapture={handlePhotoCapture}
        onCancel={() => setShowPhotoCapture(false)}
      />
    );
  }

  if (showSignatureCapture) {
    return (
      <SignatureCanvas
        onSave={handleSignatureSave}
        onCancel={() => setShowSignatureCapture(false)}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-4 border-b sticky top-0 bg-white">
          <h3 className="text-lg font-semibold">Complete Delivery</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-900">Delivering:</p>
            <p className="text-blue-700">{cargoDescription}</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Photo (Optional)
            </label>
            {photoPreview ? (
              <div className="space-y-2">
                <img src={photoPreview} alt="Delivery" className="w-full rounded-lg border" />
                <button
                  onClick={() => {
                    setPhoto(null);
                    setPhotoPreview(null);
                  }}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Remove Photo
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowPhotoCapture(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
              >
                <Camera className="w-5 h-5" />
                Take Photo
              </button>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Signature <span className="text-red-500">*</span>
            </label>
            {signature ? (
              <div className="space-y-2">
                <div className="border rounded-lg p-2 bg-white">
                  <img src={signature} alt="Signature" className="w-full h-32 object-contain" />
                </div>
                <button
                  onClick={() => setSignature(null)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Clear Signature
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowSignatureCapture(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
              >
                <FileSignature className="w-5 h-5" />
                Get Signature
              </button>
            )}
          </div>

          <div>
            <label htmlFor="recipientName" className="block text-sm font-medium text-gray-700 mb-2">
              Recipient Name <span className="text-red-500">*</span>
            </label>
            <input
              id="recipientName"
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Enter recipient's full name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
              Delivery Notes (Optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes about the delivery..."
              rows={3}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !signature || !recipientName.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>Processing...</>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Delivery
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
