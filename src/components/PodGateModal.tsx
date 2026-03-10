import { useState, useRef } from 'react';
import { X, Camera, Edit, CheckCircle, Loader2, AlertTriangle, Monitor, Shield } from 'lucide-react';
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

interface PodGateModalProps {
  jobId: string;
  stopId: string;
  stopAddress: string;
  podStop: PODStop | null;
  podRequired: string;
  onPodComplete: (updatedPodStop: PODStop) => void;
  onDismiss: () => void;
  onNotification: (message: string, type: 'success' | 'info' | 'warning') => void;
}

export function PodGateModal({
  jobId,
  stopId,
  stopAddress,
  podStop,
  podRequired,
  onPodComplete,
  onDismiss,
  onNotification
}: PodGateModalProps) {
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [currentPodStop, setCurrentPodStop] = useState<PODStop | null>(podStop);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isDesktop = !isMobile;

  const needsPhoto = podRequired === 'PHOTO' || podRequired === 'PHOTO_AND_SIGNATURE';
  const needsSignature = podRequired === 'SIGNATURE' || podRequired === 'PHOTO_AND_SIGNATURE';

  const hasPhoto = currentPodStop && currentPodStop.photo_urls && currentPodStop.photo_urls.length > 0;
  const hasSignature = currentPodStop && currentPodStop.signature_image_url;

  const isComplete = (!needsPhoto || hasPhoto) && (!needsSignature || hasSignature);

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

      let updatedPod = currentPodStop;

      if (!updatedPod) {
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
        updatedPod = newPod;
      }

      const allPhotoDone = true;
      const allSigDone = !needsSignature || !!hasSignature;

      const { data: refreshedPod, error: updateError } = await supabase
        .from('pod_stops')
        .update({
          photo_urls: [...(updatedPod.photo_urls || []), ...uploadedUrls],
          status: allPhotoDone && allSigDone ? 'COMPLETED' : 'PENDING',
          completed_at: allPhotoDone && allSigDone ? new Date().toISOString() : null
        })
        .eq('id', updatedPod.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setCurrentPodStop(refreshedPod);
      onNotification(`${uploadedUrls.length} photo(s) uploaded`, 'success');

      const updatedNeedsSignature = needsSignature && !refreshedPod.signature_image_url;
      if (!updatedNeedsSignature) {
        onPodComplete(refreshedPod);
      }
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

      let updatedPod = currentPodStop;

      if (!updatedPod) {
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
        updatedPod = newPod;
      }

      const photoDone = !needsPhoto || (updatedPod.photo_urls && updatedPod.photo_urls.length > 0);

      const { data: refreshedPod, error: updateError } = await supabase
        .from('pod_stops')
        .update({
          signature_image_url: publicUrl,
          status: photoDone ? 'COMPLETED' : 'PENDING',
          completed_at: photoDone ? new Date().toISOString() : null
        })
        .eq('id', updatedPod.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setCurrentPodStop(refreshedPod);
      onNotification('Signature saved', 'success');
      setShowSignatureCanvas(false);

      const photoStillNeeded = needsPhoto && !(refreshedPod.photo_urls && refreshedPod.photo_urls.length > 0);
      if (!photoStillNeeded) {
        onPodComplete(refreshedPod);
      }
    } catch (error) {
      console.error('Error saving signature:', error);
      onNotification('Failed to save signature', 'warning');
    } finally {
      setSavingSignature(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[95vh] overflow-y-auto animate-in slide-in-from-bottom duration-300">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
                <Shield className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Proof of Delivery</h3>
                <p className="text-xs text-gray-500 mt-0.5 max-w-[200px] truncate">{stopAddress}</p>
              </div>
            </div>
            <button
              onClick={onDismiss}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close (you can return later)"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-amber-900 text-sm">Required before completing delivery</p>
                <p className="text-xs text-amber-700 mt-1">
                  Collect the recipient's {needsSignature && needsPhoto ? 'signature and photo proof' : needsSignature ? 'signature' : 'photo proof'} to unlock job completion.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {needsSignature && (
              <div className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                hasSignature
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white border-gray-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  hasSignature ? 'bg-green-500' : 'bg-gray-200'
                }`}>
                  {hasSignature ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <Edit className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${hasSignature ? 'text-green-800' : 'text-gray-900'}`}>
                    E-Signature
                  </p>
                  <p className="text-xs text-gray-500">
                    {hasSignature ? 'Collected' : 'Tap to capture'}
                  </p>
                </div>
                {!hasSignature && (
                  <button
                    onClick={() => setShowSignatureCanvas(true)}
                    disabled={savingSignature}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                  >
                    {savingSignature ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Edit className="w-4 h-4" />
                    )}
                    Sign
                  </button>
                )}
              </div>
            )}

            {needsPhoto && (
              <div className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
                hasPhoto
                  ? 'bg-green-50 border-green-300'
                  : 'bg-white border-gray-200'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  hasPhoto ? 'bg-green-500' : 'bg-gray-200'
                }`}>
                  {hasPhoto ? (
                    <CheckCircle className="w-4 h-4 text-white" />
                  ) : (
                    <Camera className="w-4 h-4 text-gray-500" />
                  )}
                </div>
                <div className="flex-1">
                  <p className={`font-semibold text-sm ${hasPhoto ? 'text-green-800' : 'text-gray-900'}`}>
                    Delivery Photo
                  </p>
                  <p className="text-xs text-gray-500">
                    {hasPhoto ? `${currentPodStop?.photo_urls.length} uploaded` : 'Tap to capture'}
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingPhotos}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${
                    hasPhoto
                      ? 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {uploadingPhotos ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Camera className="w-4 h-4" />
                  )}
                  {hasPhoto ? 'More' : 'Photo'}
                </button>
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
              </div>
            )}
          </div>

          {isDesktop && needsSignature && !hasSignature && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Monitor className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Use your mouse or trackpad to draw the signature on desktop.
                </p>
              </div>
            </div>
          )}

          {isComplete ? (
            <div className="bg-green-50 border-2 border-green-300 rounded-xl p-5 text-center">
              <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
              <p className="font-bold text-green-900">All POD requirements met</p>
              <p className="text-sm text-green-700 mt-1">You can now complete this delivery.</p>
            </div>
          ) : (
            <button
              onClick={onDismiss}
              className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl font-medium text-sm transition-colors"
            >
              Close (I'll come back to this)
            </button>
          )}
        </div>
      </div>

      {showSignatureCanvas && (
        <SignatureCanvas
          onSave={handleSaveSignature}
          onCancel={() => setShowSignatureCanvas(false)}
        />
      )}
    </div>
  );
}
