import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Banknote, Camera, Loader2, CheckCircle, Edit, ArrowRight, Handshake, Trash2, Shield, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CashDeliveryModalProps {
  jobId: string;
  stopId: string;
  stopAddress: string;
  cashAmount: number;
  podRequired: string;
  podStopId?: string;
  onComplete: () => void;
  onCancel: () => void;
  onNotification: (message: string, type: 'success' | 'info' | 'warning') => void;
}

export function CashDeliveryModal({
  jobId,
  stopId,
  stopAddress,
  cashAmount,
  podRequired,
  podStopId,
  onComplete,
  onCancel,
  onNotification
}: CashDeliveryModalProps) {
  const [step, setStep] = useState<'review' | 'sign' | 'confirm'>('review');
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [cashPhotoUrl, setCashPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [recipientName, setRecipientName] = useState('');
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const initCanvas = useCallback(() => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (step === 'sign' && !signatureUrl) {
      const timer = setTimeout(initCanvas, 50);
      return () => clearTimeout(timer);
    }
  }, [step, signatureUrl, initCanvas]);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    setIsDrawing(true);
    setHasDrawn(true);
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const doDraw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const clearSigCanvas = () => {
    setHasDrawn(false);
    initCanvas();
  };

  const saveSigCanvas = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureUrl(dataUrl);
    setStep('confirm');
  };

  const uploadSignature = async (dataUrl: string): Promise<string | null> => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `${jobId}/${stopId}/delivery-signature-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('pod-photos')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pod-photos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading delivery signature:', error);
      return dataUrl;
    }
  };

  const handleUploadPhoto = async (files: FileList) => {
    setUploading(true);
    try {
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${jobId}/${stopId}/delivery-photo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('pod-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pod-photos')
        .getPublicUrl(fileName);

      setCashPhotoUrl(publicUrl);
      onNotification('Photo uploaded', 'success');
    } catch (error) {
      console.error('Error uploading delivery photo:', error);
      onNotification('Failed to upload photo', 'warning');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!signatureUrl) return;
    setConfirming(true);
    try {
      const uploadedSigUrl = await uploadSignature(signatureUrl);

      const needsSignature = podRequired === 'SIGNATURE' || podRequired === 'PHOTO_AND_SIGNATURE';

      if (needsSignature && uploadedSigUrl) {
        let currentPodStopId = podStopId;

        if (!currentPodStopId) {
          const { data: newPod, error: insertError } = await supabase
            .from('pod_stops')
            .insert({
              stop_id: stopId,
              job_id: jobId,
              required_type: podRequired,
              status: 'COMPLETED'
            })
            .select('id')
            .single();

          if (insertError) throw insertError;
          currentPodStopId = newPod.id;
        }

        if (currentPodStopId) {
          const { error: podError } = await supabase
            .from('pod_stops')
            .update({
              signature_image_url: uploadedSigUrl,
              recipient_name: recipientName || null,
              status: 'COMPLETED',
              completed_at: new Date().toISOString()
            })
            .eq('id', currentPodStopId);

          if (podError) throw podError;
        }
      }

      const completionTime = new Date().toISOString();
      const { error: stopError } = await supabase
        .from('delivery_stops')
        .update({
          status: 'COMPLETED',
          completed_at: completionTime,
          updated_at: completionTime
        })
        .eq('id', stopId);

      if (stopError) throw stopError;

      const { data: cargoItems } = await supabase
        .from('cargo_items')
        .select('id')
        .eq('job_id', jobId)
        .neq('status', 'delivered');

      if (cargoItems && cargoItems.length > 0) {
        const cargoIds = cargoItems.map(c => c.id);
        await supabase
          .from('cargo_items')
          .update({
            status: 'delivered',
            delivered_at: completionTime,
            delivered_to_name: recipientName || null
          })
          .in('id', cargoIds);
      }

      await supabase
        .from('cash_collections')
        .update({
          returned_at: completionTime,
          return_signature_url: uploadedSigUrl,
          status: 'returned'
        })
        .eq('job_id', jobId);

      await supabase
        .from('jobs')
        .update({
          cash_collection_status: 'returned',
          updated_at: completionTime
        })
        .eq('id', jobId);

      onNotification('Delivery confirmed and cash return verified!', 'success');
      onComplete();
    } catch (error) {
      console.error('Error confirming delivery:', error);
      onNotification('Failed to confirm delivery', 'warning');
    } finally {
      setConfirming(false);
    }
  };

  const stepIndicator = (
    <div className="flex items-center gap-1 px-6 py-3 bg-amber-50 border-b border-amber-100">
      <div className={`flex items-center gap-1.5 ${step === 'review' ? 'text-amber-700 font-bold' : 'text-green-600'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 'review' ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {step === 'review' ? '1' : <CheckCircle className="w-3.5 h-3.5" />}
        </div>
        <span className="text-xs">Review</span>
      </div>
      <div className="flex-1 h-px bg-gray-300 mx-1" />
      <div className={`flex items-center gap-1.5 ${
        step === 'sign' ? 'text-amber-700 font-bold' : step === 'confirm' ? 'text-green-600' : 'text-gray-400'
      }`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 'sign' ? 'bg-amber-500 text-white' : step === 'confirm' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
        }`}>
          {step === 'confirm' ? <CheckCircle className="w-3.5 h-3.5" /> : '2'}
        </div>
        <span className="text-xs">Sign</span>
      </div>
      <div className="flex-1 h-px bg-gray-300 mx-1" />
      <div className={`flex items-center gap-1.5 ${step === 'confirm' ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 'confirm' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'
        }`}>3</div>
        <span className="text-xs">Confirm</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10">
          <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-6 py-5 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Banknote className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Cash Delivery</h3>
                <p className="text-xs text-white/80">
                  {step === 'review' && 'Confirm delivery details'}
                  {step === 'sign' && 'Hand device to recipient to sign'}
                  {step === 'confirm' && 'Review and confirm delivery'}
                </p>
              </div>
            </div>
            <button
              onClick={onCancel}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
          {stepIndicator}
        </div>

        <div className="p-6 space-y-5">
          {step === 'review' && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                <p className="text-xs text-amber-700 font-medium mb-1">Delivery Amount</p>
                <p className="text-3xl font-black text-amber-700">TTD ${cashAmount.toLocaleString()}</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide mb-1">Delivery Location</p>
                <p className="text-sm text-gray-800 font-medium">{stopAddress}</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Recipient Name (optional)
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Name of person receiving delivery"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-900 font-semibold mb-1">The recipient will confirm:</p>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    The cargo/items were received in good condition
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    Handing over TTD ${cashAmount.toLocaleString()} in cash to the driver
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    The cash amount is correct and complete
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setStep('sign')}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
              >
                Next: Get Recipient Signature <ArrowRight className="w-5 h-5" />
              </button>
            </>
          )}

          {step === 'sign' && (
            <>
              <div className="bg-white rounded-xl p-3 border border-amber-200 text-center mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">Cash Amount</p>
                <p className="text-2xl font-black text-gray-900">TTD ${cashAmount.toLocaleString()}</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
                <p className="text-xs text-amber-900 font-semibold mb-1">By signing below, the recipient confirms:</p>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    Cargo was signed for and received in good condition
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    Handing over TTD ${cashAmount.toLocaleString()} cash received
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    Cash amount is correct
                  </li>
                </ul>
              </div>

              {signatureUrl ? (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 rounded-xl border-2 border-green-300">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-bold text-green-800">Signature Captured</span>
                    </div>
                    <img src={signatureUrl} alt="Signature" className="h-16 w-auto mx-auto bg-white rounded-lg p-1" />
                  </div>
                  <button
                    onClick={() => setSignatureUrl(null)}
                    className="text-sm text-blue-600 font-medium hover:underline"
                  >
                    Redo Signature
                  </button>
                </div>
              ) : (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Sign here:</p>
                  <div className="relative border-2 border-gray-300 rounded-lg bg-white overflow-hidden">
                    <canvas
                      ref={sigCanvasRef}
                      className="w-full h-48 touch-none cursor-crosshair"
                      onMouseDown={startDraw}
                      onMouseMove={doDraw}
                      onMouseUp={() => setIsDrawing(false)}
                      onMouseLeave={() => setIsDrawing(false)}
                      onTouchStart={startDraw}
                      onTouchMove={doDraw}
                      onTouchEnd={() => setIsDrawing(false)}
                    />
                    {!hasDrawn && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <Edit className="w-8 h-8 text-gray-300 mb-1" />
                        <p className="text-gray-300 text-sm font-medium">Draw signature here</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={clearSigCanvas}
                      className="flex-1 py-2.5 px-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium text-gray-700 text-sm flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" /> Clear
                    </button>
                    <button
                      onClick={saveSigCanvas}
                      disabled={!hasDrawn}
                      className="flex-1 py-2.5 px-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-sm flex items-center justify-center gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" /> Save Signature
                    </button>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('review')}
                  className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold transition-all hover:border-gray-300"
                >
                  Back
                </button>
                {signatureUrl && (
                  <button
                    onClick={() => setStep('confirm')}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'confirm' && (
            <>
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                    <Handshake className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-green-900">Both Parties Agreed</p>
                    <p className="text-xs text-green-700">Recipient confirmed cargo received in good condition and cash handed over</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 pb-2 mb-2 border-b border-gray-100">
                    <Package className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700">Cargo received in good condition</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Cash Collected</span>
                    <span className="text-xl font-bold text-gray-900">TTD ${cashAmount.toLocaleString()}</span>
                  </div>
                  {recipientName && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Received By</span>
                      <span className="text-sm font-semibold text-gray-900">{recipientName}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Recipient Signature</p>
                    <img src={signatureUrl!} alt="Signature" className="h-12 w-auto" />
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border-2 ${
                cashPhotoUrl ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-sm text-gray-800">Delivery Photo (Optional)</span>
                  </div>
                  {cashPhotoUrl && <CheckCircle className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Photo of delivery for added security
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleUploadPhoto(e.target.files);
                    }
                  }}
                  className="hidden"
                />
                {cashPhotoUrl && (
                  <div className="mb-3 p-2 bg-white rounded-lg border border-green-200">
                    <img src={cashPhotoUrl} alt="Delivery" className="h-24 w-auto mx-auto rounded" />
                  </div>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm"
                >
                  {uploading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                  ) : (
                    <><Camera className="w-4 h-4" /> {cashPhotoUrl ? 'Retake Photo' : 'Take Photo'}</>
                  )}
                </button>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-amber-700 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-800">
                    By confirming, you acknowledge that the cargo was delivered in good condition and
                    TTD ${cashAmount.toLocaleString()} was collected from the recipient. The delivery will be marked as complete.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('sign')}
                  className="py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold transition-all hover:border-gray-300"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={confirming}
                  className="flex-1 py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 disabled:shadow-none"
                >
                  {confirming ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Confirming...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> Confirm Delivery</>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
