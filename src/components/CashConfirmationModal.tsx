import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Banknote, Camera, AlertTriangle, Loader2, CheckCircle, Edit, Shield, ArrowRight, UserCheck, Handshake, Trash2, Package } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CashConfirmationModalProps {
  jobId: string;
  expectedAmount: number;
  driverUserId: string;
  onConfirmed: () => void;
  onCancel: () => void;
  onNotification: (message: string, type: 'success' | 'info' | 'warning') => void;
}

export function CashConfirmationModal({
  jobId,
  expectedAmount,
  driverUserId,
  onConfirmed,
  onCancel,
  onNotification
}: CashConfirmationModalProps) {
  const [actualAmount, setActualAmount] = useState(expectedAmount.toString());
  const [varianceReason, setVarianceReason] = useState('');
  const [varianceCategory, setVarianceCategory] = useState('');
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [cashPhotoUrl, setCashPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [step, setStep] = useState<'amount' | 'recipient_sign' | 'driver_confirm'>('amount');
  const [recipientName, setRecipientName] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);

  const parsedAmount = parseFloat(actualAmount) || 0;
  const hasVariance = parsedAmount !== expectedAmount;
  const isShort = parsedAmount < expectedAmount;

  const handleUploadPhoto = async (files: FileList) => {
    setUploading(true);
    try {
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${jobId}/cash-photo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('pod-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pod-photos')
        .getPublicUrl(fileName);

      setCashPhotoUrl(publicUrl);
      onNotification('Cash photo uploaded', 'success');
    } catch (error) {
      console.error('Error uploading cash photo:', error);
      onNotification('Failed to upload photo', 'warning');
    } finally {
      setUploading(false);
    }
  };

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
    if (step === 'recipient_sign' && !signatureUrl) {
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
    setStep('driver_confirm');
  };

  const uploadSignature = async (dataUrl: string): Promise<string | null> => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `${jobId}/cash-signature-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('pod-photos')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pod-photos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading signature:', error);
      return dataUrl;
    }
  };

  const handleConfirmCash = async () => {
    if (!signatureUrl) {
      onNotification('Recipient signature is required to confirm cash collection', 'warning');
      return;
    }

    if (hasVariance && !varianceCategory) {
      onNotification('Please select a reason for the amount difference', 'warning');
      return;
    }

    setConfirming(true);
    try {
      const uploadedSignatureUrl = signatureUrl ? await uploadSignature(signatureUrl) : null;

      const { error: insertError } = await supabase
        .from('cash_collections')
        .insert({
          job_id: jobId,
          expected_amount: expectedAmount,
          actual_amount: parsedAmount,
          variance_reason: hasVariance ? `${varianceCategory}${varianceReason ? ': ' + varianceReason : ''}` : null,
          customer_signature_url: uploadedSignatureUrl,
          cash_photo_url: cashPhotoUrl,
          recipient_confirmed: true,
          recipient_confirmed_at: new Date().toISOString(),
          collected_by_user_id: driverUserId,
          collected_at: new Date().toISOString(),
          status: 'collected'
        });

      if (insertError) throw insertError;

      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          cash_collection_status: 'collected',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (jobError) throw jobError;

      onNotification(`Cash confirmed: TTD $${parsedAmount.toFixed(0)} collected`, 'success');
      onConfirmed();
    } catch (error) {
      console.error('Error confirming cash:', error);
      onNotification('Failed to confirm cash collection', 'warning');
    } finally {
      setConfirming(false);
    }
  };

  const canProceedToSign = parsedAmount > 0 && (!hasVariance || varianceCategory);

  const stepIndicator = (
    <div className="flex items-center gap-1 px-6 py-3 bg-amber-50 border-b border-amber-100">
      <div className={`flex items-center gap-1.5 ${step === 'amount' ? 'text-amber-700 font-bold' : 'text-green-600'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 'amount' ? 'bg-amber-500 text-white' : 'bg-green-500 text-white'
        }`}>
          {step === 'amount' ? '1' : <CheckCircle className="w-3.5 h-3.5" />}
        </div>
        <span className="text-xs">Amount</span>
      </div>
      <div className="flex-1 h-px bg-gray-300 mx-1" />
      <div className={`flex items-center gap-1.5 ${
        step === 'recipient_sign' ? 'text-amber-700 font-bold' : step === 'driver_confirm' ? 'text-green-600' : 'text-gray-400'
      }`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 'recipient_sign' ? 'bg-amber-500 text-white' : step === 'driver_confirm' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
        }`}>
          {step === 'driver_confirm' ? <CheckCircle className="w-3.5 h-3.5" /> : '2'}
        </div>
        <span className="text-xs">Sign</span>
      </div>
      <div className="flex-1 h-px bg-gray-300 mx-1" />
      <div className={`flex items-center gap-1.5 ${step === 'driver_confirm' ? 'text-amber-700 font-bold' : 'text-gray-400'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 'driver_confirm' ? 'bg-amber-500 text-white' : 'bg-gray-200 text-gray-500'
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
                <h3 className="text-lg font-bold text-white">Cash Collection</h3>
                <p className="text-xs text-white/80">
                  {step === 'amount' && 'Enter amount received from recipient'}
                  {step === 'recipient_sign' && 'Hand device to recipient to sign'}
                  {step === 'driver_confirm' && 'Review and confirm collection'}
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
          {step === 'amount' && (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-amber-800">Expected Amount</span>
                  <span className="text-2xl font-bold text-amber-700">TTD ${expectedAmount.toFixed(0)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Actual Amount Received (TTD) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-lg">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={actualAmount}
                    onChange={(e) => setActualAmount(e.target.value)}
                    className={`w-full pl-10 pr-4 py-4 text-2xl font-bold border-2 rounded-xl focus:ring-2 focus:border-transparent ${
                      hasVariance
                        ? 'border-orange-300 text-orange-700 focus:ring-orange-500'
                        : 'border-green-300 text-green-700 focus:ring-green-500'
                    }`}
                  />
                </div>
                {!hasVariance && parsedAmount > 0 && (
                  <div className="flex items-center gap-2 mt-2 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-sm font-medium">Amount matches expected</span>
                  </div>
                )}
              </div>

              {hasVariance && parsedAmount > 0 && (
                <div className="bg-orange-50 border-2 border-orange-300 rounded-xl p-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-orange-900 text-sm">
                        {isShort ? 'Shortfall' : 'Overpayment'}: TTD ${Math.abs(parsedAmount - expectedAmount).toFixed(0)}
                      </p>
                      <p className="text-xs text-orange-700 mt-1">
                        {isShort
                          ? 'The amount received is less than expected. Please select a reason.'
                          : 'The amount received is more than expected. Please confirm.'}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-orange-800 mb-2">
                      Reason <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={varianceCategory}
                      onChange={(e) => setVarianceCategory(e.target.value)}
                      className="w-full px-3 py-2.5 border border-orange-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white"
                    >
                      <option value="">Select a reason...</option>
                      <option value="Customer only had partial amount">Customer only had partial amount</option>
                      <option value="Customer disputes amount owed">Customer disputes amount owed</option>
                      <option value="Customer will pay remainder later">Customer will pay remainder later</option>
                      <option value="Change given to customer">Change given to customer</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  {varianceCategory === 'Other' && (
                    <textarea
                      value={varianceReason}
                      onChange={(e) => setVarianceReason(e.target.value)}
                      placeholder="Please explain..."
                      rows={2}
                      className="w-full px-3 py-2.5 border border-orange-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
                    />
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-800 mb-2">
                  Recipient Name (optional)
                </label>
                <input
                  type="text"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Name of person paying"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                />
              </div>

              <button
                onClick={() => setStep('recipient_sign')}
                disabled={!canProceedToSign}
                className="w-full py-4 px-6 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:shadow-none"
              >
                Next: Get Recipient Signature <ArrowRight className="w-5 h-5" />
              </button>
            </>
          )}

          {step === 'recipient_sign' && (
            <>
              <div className="bg-white rounded-xl p-3 border border-blue-200 text-center mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">Cash Amount</p>
                <p className="text-2xl font-black text-gray-900">TTD ${parsedAmount.toFixed(0)}</p>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-left">
                <p className="text-xs text-amber-900 font-semibold mb-1">By signing below, the recipient confirms:</p>
                <ul className="text-xs text-amber-800 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <Package className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    The delivered cargo/items were received in good condition
                  </li>
                  <li className="flex items-start gap-1.5">
                    <Banknote className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    Handing over TTD ${parsedAmount.toFixed(0)} in cash to the driver as payment
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 flex-shrink-0" />
                    The cash amount is correct and complete
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
                  onClick={() => setStep('amount')}
                  className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold transition-all hover:border-gray-300"
                >
                  Back
                </button>
                {signatureUrl && (
                  <button
                    onClick={() => setStep('driver_confirm')}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20"
                  >
                    Continue <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          )}

          {step === 'driver_confirm' && (
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
                    <span className="text-xl font-bold text-gray-900">TTD ${parsedAmount.toFixed(0)}</span>
                  </div>
                  {recipientName && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">Paid By</span>
                      <span className="text-sm font-semibold text-gray-900">{recipientName}</span>
                    </div>
                  )}
                  {hasVariance && (
                    <div className="flex justify-between items-center text-orange-700">
                      <span className="text-sm">Variance</span>
                      <span className="text-sm font-semibold">{isShort ? '-' : '+'}TTD ${Math.abs(parsedAmount - expectedAmount).toFixed(0)}</span>
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
                    <span className="font-medium text-sm text-gray-800">Cash Photo (Optional)</span>
                  </div>
                  {cashPhotoUrl && <CheckCircle className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Photo of cash received for added security
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
                    <img src={cashPhotoUrl} alt="Cash" className="h-24 w-auto mx-auto rounded" />
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
                    TTD ${parsedAmount.toFixed(0)} in cash was collected from the recipient.
                    This cash must be returned to the job creator before the job can be marked complete.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('recipient_sign')}
                  className="py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold transition-all hover:border-gray-300"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirmCash}
                  disabled={confirming}
                  className="flex-1 py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 disabled:shadow-none"
                >
                  {confirming ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Confirming...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> Confirm Cash Collected</>
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
