import { useState, useRef } from 'react';
import { Camera, Edit, CheckCircle, Loader2, Monitor, Circle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { SignatureCanvas } from './SignatureCanvas';

interface PODStop {
  id: string;
  stop_id: string;
  job_id: string;
  required_type: 'NONE' | 'PHOTO' | 'SIGNATURE' | 'PHOTO_AND_SIGNATURE';
  status: 'NOT_REQUIRED' | 'REQUIRED' | 'PENDING' | 'COMPLETED';
  photo_urls: string[];
  signature_image_url: string | null;
  signed_by_name: string | null;
  recipient_name: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  notes: string | null;
}

interface DriverCockpitPODProps {
  jobId: string;
  stopId: string;
  podStop: PODStop | null;
  podRequired: string;
  onUpdate: () => void | Promise<void>;
  onNotification: (message: string, type: 'success' | 'info' | 'warning') => void;
  cashCollectionStatus?: string;
  hasCashToReturn?: boolean;
}

export function DriverCockpitPOD({
  jobId,
  stopId,
  podStop,
  podRequired,
  onUpdate,
  onNotification,
  cashCollectionStatus,
  hasCashToReturn
}: DriverCockpitPODProps) {
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isDesktop = !isMobile;

  const needsPhoto = podRequired === 'PHOTO' || podRequired === 'PHOTO_AND_SIGNATURE';
  const needsSignature = podRequired === 'SIGNATURE' || podRequired === 'PHOTO_AND_SIGNATURE';

  const hasPhoto = podStop && podStop.photo_urls && podStop.photo_urls.length > 0;
  const hasSignature = podStop && podStop.signature_image_url;

  const isComplete = (!needsPhoto || hasPhoto) && (!needsSignature || hasSignature);
  const pickupSignatureDone = hasCashToReturn && (cashCollectionStatus === 'collected' || cashCollectionStatus === 'returned');

  const handleUploadPhotos = async (files: FileList) => {
    setUploadingPhotos(true);
    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${jobId}/${stopId}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('pod-photos')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('pod-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      let currentPod = podStop;

      if (!currentPod) {
        const { data: newPod, error: insertError } = await supabase
          .from('pod_stops')
          .insert({
            stop_id: stopId,
            job_id: jobId,
            required_type: podRequired,
            status: podRequired === 'NONE' ? 'NOT_REQUIRED' : 'REQUIRED'
          })
          .select()
          .single();

        if (insertError) throw insertError;
        currentPod = newPod;
      }

      const { error: updateError } = await supabase
        .from('pod_stops')
        .update({
          photo_urls: [...(currentPod.photo_urls || []), ...uploadedUrls],
          status: needsSignature && !hasSignature ? 'PENDING' : 'COMPLETED',
          completed_at: (!needsSignature || hasSignature) ? new Date().toISOString() : null
        })
        .eq('id', currentPod.id);

      if (updateError) throw updateError;

      onNotification(`${uploadedUrls.length} photo(s) uploaded`, 'success');
      await onUpdate();
    } catch (error) {
      console.error('Error uploading photos:', error);
      onNotification('Failed to upload photos', 'warning');
    } finally {
      setUploadingPhotos(false);
    }
  };

  const handleSaveSignature = async (signatureDataUrl: string) => {
    setSavingSignature(true);
    try {
      const blob = await (await fetch(signatureDataUrl)).blob();
      const fileName = `${jobId}/${stopId}/signature-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('pod-photos')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pod-photos')
        .getPublicUrl(fileName);

      let currentPod = podStop;

      if (!currentPod) {
        const { data: newPod, error: insertError } = await supabase
          .from('pod_stops')
          .insert({
            stop_id: stopId,
            job_id: jobId,
            required_type: podRequired,
            status: podRequired === 'NONE' ? 'NOT_REQUIRED' : 'REQUIRED'
          })
          .select()
          .single();

        if (insertError) throw insertError;
        currentPod = newPod;
      }

      const { error: updateError } = await supabase
        .from('pod_stops')
        .update({
          signature_image_url: publicUrl,
          status: needsPhoto && !hasPhoto ? 'PENDING' : 'COMPLETED',
          completed_at: (!needsPhoto || hasPhoto) ? new Date().toISOString() : null
        })
        .eq('id', currentPod.id);

      if (updateError) throw updateError;

      onNotification('Signature saved', 'success');
      setShowSignatureCanvas(false);
      await onUpdate();
    } catch (error) {
      console.error('Error saving signature:', error);
      onNotification('Failed to save signature', 'warning');
    } finally {
      setSavingSignature(false);
    }
  };

  return (
    <div className="mt-3 pt-3 border-t-2 border-orange-200 bg-orange-50 -mx-4 px-4 pb-4">
      {pickupSignatureDone && needsSignature && (
        <div className="space-y-2.5 mb-4">
          <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-green-900">Signature on Pickup</p>
              <p className="text-xs text-green-700">Cash collection signature captured</p>
            </div>
          </div>

          <div className={`flex items-center gap-3 p-3 rounded-xl border ${
            hasSignature
              ? 'bg-green-50 border-green-200'
              : 'bg-amber-50 border-amber-200'
          }`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
              hasSignature ? 'bg-green-500' : 'bg-amber-200'
            }`}>
              {hasSignature ? (
                <CheckCircle className="w-4 h-4 text-white" />
              ) : (
                <Circle className="w-4 h-4 text-amber-500" />
              )}
            </div>
            <div className="flex-1">
              <p className={`text-sm font-bold ${hasSignature ? 'text-green-900' : 'text-amber-900'}`}>
                Signature on Delivery
              </p>
              <p className={`text-xs ${hasSignature ? 'text-green-700' : 'text-amber-700'}`}>
                {hasSignature ? 'Recipient signature captured' : 'Recipient signature needed'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!pickupSignatureDone && needsSignature && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs font-medium border border-amber-300">
            <Edit className="w-3 h-3" />
            Signature required
          </span>
        </div>
      )}

      {needsPhoto && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-full text-xs font-medium border border-orange-300">
            <Camera className="w-3 h-3" />
            Photo required
          </span>
        </div>
      )}

      <div className="space-y-2">
        {needsPhoto && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              capture="environment"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadPhotos(e.target.files);
                }
              }}
              className="hidden"
            />

            {hasPhoto && (
              <div className="flex items-center gap-2 p-2.5 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-800">
                  {podStop?.photo_urls.length} photo(s) uploaded
                </span>
              </div>
            )}

            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhotos}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
            >
              {uploadingPhotos ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  {hasPhoto ? 'Add More Photos' : 'Upload Photo'}
                </>
              )}
            </button>
          </>
        )}

        {needsSignature && !hasSignature && (
          <>
            <button
              onClick={() => setShowSignatureCanvas(true)}
              disabled={savingSignature}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm shadow-sm"
            >
              {savingSignature ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4" />
                  Capture Delivery Signature
                </>
              )}
            </button>
            {isDesktop && (
              <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Monitor className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700">
                    Use your mouse or trackpad to draw the signature.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {needsSignature && hasSignature && (
          <div className="space-y-2">
            <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-800">Delivery signature captured</span>
              </div>
              <img src={podStop?.signature_image_url || ''} alt="Signature" className="h-12 w-auto bg-white rounded p-1" />
            </div>
            <button
              onClick={() => setShowSignatureCanvas(true)}
              className="text-xs text-blue-600 font-medium hover:underline"
            >
              Recapture Signature
            </button>
          </div>
        )}
      </div>

      {isComplete && (
        <div className="mt-3 p-2 bg-green-50 border border-green-300 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <p className="text-xs text-green-800 font-medium">
            POD complete. You can now mark as Delivered.
          </p>
        </div>
      )}

      {showSignatureCanvas && (
        <SignatureCanvas
          onSave={handleSaveSignature}
          onCancel={() => setShowSignatureCanvas(false)}
        />
      )}
    </div>
  );
}
