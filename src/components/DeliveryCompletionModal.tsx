import { useState, useRef } from 'react';
import { X, Camera, Edit, CheckCircle, XCircle, Loader2, AlertCircle, Package, User, Monitor } from 'lucide-react';
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

interface DeliveryCompletionModalProps {
  jobId: string;
  stopId: string;
  stopAddress: string;
  stopType: 'PICKUP' | 'DROPOFF';
  podStop: PODStop | null;
  podRequired: string;
  onComplete: () => void;
  onCancel: () => void;
  onNotification: (message: string, type: 'success' | 'info' | 'warning') => void;
}

export function DeliveryCompletionModal({
  jobId,
  stopId,
  stopAddress,
  stopType,
  podStop,
  podRequired,
  onComplete,
  onCancel,
  onNotification
}: DeliveryCompletionModalProps) {
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [showSignatureCanvas, setShowSignatureCanvas] = useState(false);
  const [savingSignature, setSavingSignature] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [recipientName, setRecipientName] = useState(podStop?.recipient_name || '');
  const [deliveryNotes, setDeliveryNotes] = useState(podStop?.notes || '');
  const [currentPodStop, setCurrentPodStop] = useState<PODStop | null>(podStop);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isDesktop = !isMobile;

  const needsPhoto = podRequired === 'PHOTO' || podRequired === 'PHOTO_AND_SIGNATURE';
  const needsSignature = podRequired === 'SIGNATURE' || podRequired === 'PHOTO_AND_SIGNATURE';

  const hasPhoto = currentPodStop && currentPodStop.photo_urls && currentPodStop.photo_urls.length > 0;
  const hasSignature = currentPodStop && currentPodStop.signature_image_url;

  const canComplete =
    (stopType === 'PICKUP') ||
    (!needsPhoto || hasPhoto) && (!needsSignature || hasSignature);

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

      const { data: refreshedPod, error: updateError } = await supabase
        .from('pod_stops')
        .update({
          photo_urls: [...(updatedPod.photo_urls || []), ...uploadedUrls],
          status: needsSignature && !hasSignature ? 'PENDING' : 'COMPLETED',
          completed_at: (!needsSignature || hasSignature) ? new Date().toISOString() : null
        })
        .eq('id', updatedPod.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setCurrentPodStop(refreshedPod);
      onNotification(`${uploadedUrls.length} photo(s) uploaded`, 'success');
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

      const { data: refreshedPod, error: updateError } = await supabase
        .from('pod_stops')
        .update({
          signature_image_url: publicUrl,
          status: needsPhoto && !hasPhoto ? 'PENDING' : 'COMPLETED',
          completed_at: (!needsPhoto || hasPhoto) ? new Date().toISOString() : null
        })
        .eq('id', updatedPod.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setCurrentPodStop(refreshedPod);
      onNotification('Signature saved', 'success');
      setShowSignatureCanvas(false);
    } catch (error) {
      console.error('Error saving signature:', error);
      onNotification('Failed to save signature', 'warning');
    } finally {
      setSavingSignature(false);
    }
  };

  const handleCompleteDelivery = async () => {
    if (!canComplete) {
      onNotification('Please complete all POD requirements first', 'warning');
      return;
    }

    setCompleting(true);
    try {
      const completionTime = new Date().toISOString();

      // Update the delivery stop
      const { error: stopError } = await supabase
        .from('delivery_stops')
        .update({
          status: 'COMPLETED',
          completed_at: completionTime,
          notes: deliveryNotes || null
        })
        .eq('id', stopId);

      if (stopError) throw stopError;

      // Update POD stop if it exists
      if (currentPodStop) {
        const { error: podError } = await supabase
          .from('pod_stops')
          .update({
            status: 'COMPLETED',
            recipient_name: recipientName || null,
            notes: deliveryNotes || null,
            completed_at: completionTime
          })
          .eq('id', currentPodStop.id);

        if (podError) throw podError;
      }

      // Update cargo items to delivered status
      if (stopType === 'DROPOFF') {
        const { data: stopData } = await supabase
          .from('delivery_stops')
          .select('location_text')
          .eq('id', stopId)
          .single();

        if (stopData) {
          const { data: cargoItems } = await supabase
            .from('cargo_items')
            .select('*')
            .eq('job_id', jobId)
            .eq('status', 'pending');

          if (cargoItems && cargoItems.length > 0) {
            const itemsToUpdate = cargoItems.filter(
              item => !item.dropoff_location_text || item.dropoff_location_text === stopData.location_text
            );

            const photoUrl = currentPodStop?.photo_urls?.[0] || null;

            for (const item of itemsToUpdate) {
              await supabase
                .from('cargo_items')
                .update({
                  delivered_at: completionTime,
                  delivered_to_name: recipientName || null,
                  delivery_proof_photo_url: photoUrl,
                  delivery_notes_from_courier: deliveryNotes || null,
                  status: 'delivered'
                })
                .eq('id', item.id);
            }
          }
        }
      }

      const actionText = stopType === 'PICKUP' ? 'Collected' : 'Delivered';
      onNotification(`${actionText} successfully!`, 'success');
      onComplete();
    } catch (error) {
      console.error('Error completing delivery:', error);
      onNotification('Failed to complete delivery', 'warning');
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">
              Complete {stopType === 'PICKUP' ? 'Collection' : 'Delivery'}
            </h3>
            <p className="text-sm text-gray-600 mt-0.5">{stopAddress}</p>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* POD Requirements Section */}
          {stopType === 'DROPOFF' && podRequired !== 'NONE' && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
              <div className="flex items-start gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <h4 className="font-bold text-orange-900 text-sm mb-2">Proof of Delivery Required</h4>

                  {/* Requirements badges */}
                  <div className="flex flex-wrap gap-2 mb-3">
                    {needsPhoto && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium border border-orange-300">
                        <Camera className="w-3 h-3" />
                        Photo required
                      </span>
                    )}
                    {needsSignature && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium border border-purple-300">
                        <Edit className="w-3 h-3" />
                        Signature required
                      </span>
                    )}
                  </div>

                  {/* Status checklist */}
                  <div className="space-y-2 bg-white rounded-lg p-3 border border-orange-200 mb-3">
                    {needsPhoto && (
                      <div className="flex items-center gap-2">
                        {hasPhoto ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                        <span className={`text-sm ${hasPhoto ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                          Photo: {hasPhoto ? `${currentPodStop?.photo_urls.length || 0} uploaded` : 'Not uploaded'}
                        </span>
                      </div>
                    )}
                    {needsSignature && (
                      <div className="flex items-center gap-2">
                        {hasSignature ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : (
                          <XCircle className="w-4 h-4 text-gray-400" />
                        )}
                        <span className={`text-sm ${hasSignature ? 'text-green-700 font-medium' : 'text-gray-600'}`}>
                          Signature: {hasSignature ? 'Collected' : 'Not collected'}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="space-y-2">
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

                    {needsPhoto && (
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
                            {hasPhoto ? 'Add More Photos' : 'Take Photo'}
                          </>
                        )}
                      </button>
                    )}

                    {needsSignature && (
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
                              {hasSignature ? 'Recapture Signature' : 'Get Recipient Signature'}
                            </>
                          )}
                        </button>
                        {isDesktop && (
                          <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-start gap-2">
                              <Monitor className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                              <p className="text-xs text-blue-700">
                                Use your mouse or trackpad to draw the signature on desktop.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Recipient Information */}
          {stopType === 'DROPOFF' && (
            <>
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <User className="w-4 h-4" />
                  Recipient Name {needsSignature && <span className="text-red-600">*</span>}
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Enter recipient's name"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Package className="w-4 h-4" />
                  Delivery Notes (Optional)
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Any additional notes about the delivery..."
                  rows={3}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                />
              </div>
            </>
          )}

          {/* Complete button */}
          <div className="pt-2">
            {!canComplete && (
              <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-800">
                  Please complete all required proof of delivery items before proceeding.
                </p>
              </div>
            )}

            <button
              onClick={handleCompleteDelivery}
              disabled={!canComplete || completing}
              className={`w-full py-3 px-4 rounded-lg font-bold text-white transition-colors flex items-center justify-center gap-2 ${
                canComplete && !completing
                  ? 'bg-green-600 hover:bg-green-700 shadow-lg'
                  : 'bg-gray-300 cursor-not-allowed'
              }`}
            >
              {completing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Completing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  {stopType === 'PICKUP' ? 'Complete Collection' : 'Confirm Delivery'}
                </>
              )}
            </button>
          </div>
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
