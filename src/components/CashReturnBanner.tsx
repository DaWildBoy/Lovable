import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Banknote, ArrowRight, Loader2, CheckCircle, AlertTriangle, X, Edit, Trash2, Camera, Shield, Handshake } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface CashReturnJob {
  id: string;
  cash_to_return_amount: number;
  cash_collection_status: string;
  pickup_location_text: string;
  customer_user_id: string;
}

interface CashReturnBannerProps {
  jobs: CashReturnJob[];
  onNavigate: (path: string) => void;
  onCashReturned?: () => void;
}

export function CashReturnBanner({ jobs, onNavigate, onCashReturned }: CashReturnBannerProps) {
  const [selectedJob, setSelectedJob] = useState<CashReturnJob | null>(null);
  const [step, setStep] = useState<'amount' | 'sender_sign' | 'confirm'>('amount');
  const [returnSignatureUrl, setReturnSignatureUrl] = useState<string | null>(null);
  const [returnPhotoUrl, setReturnPhotoUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const sigCanvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (jobs.length === 0) return null;

  const totalCash = jobs.reduce((sum, j) => sum + (j.cash_to_return_amount || 0), 0);

  const handleStartReturn = (job: CashReturnJob) => {
    setSelectedJob(job);
    setStep('amount');
    setReturnSignatureUrl(null);
    setReturnPhotoUrl(null);
    setHasDrawn(false);
  };

  const handleClose = () => {
    setSelectedJob(null);
    setReturnSignatureUrl(null);
    setReturnPhotoUrl(null);
    setHasDrawn(false);
  };

  const handleConfirmReturn = async () => {
    if (!selectedJob || !returnSignatureUrl) return;
    setConfirming(true);
    try {
      const uploadedSigUrl = await uploadSignature(returnSignatureUrl);

      const { error: collectionError } = await supabase
        .from('cash_collections')
        .update({
          returned_at: new Date().toISOString(),
          return_signature_url: uploadedSigUrl,
          return_confirmed_by_user_id: selectedJob.customer_user_id,
          status: 'returned'
        })
        .eq('job_id', selectedJob.id);

      if (collectionError) throw collectionError;

      const { error: jobError } = await supabase
        .from('jobs')
        .update({
          cash_collection_status: 'returned',
          updated_at: new Date().toISOString()
        })
        .eq('id', selectedJob.id);

      if (jobError) throw jobError;

      handleClose();
      onCashReturned?.();
    } catch (error) {
      console.error('Error confirming cash return:', error);
    } finally {
      setConfirming(false);
    }
  };

  const uploadSignature = async (dataUrl: string): Promise<string> => {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const fileName = `${selectedJob!.id}/return-signature-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from('pod-photos')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pod-photos')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading return signature:', error);
      return dataUrl;
    }
  };

  const handleUploadPhoto = async (files: FileList) => {
    if (!selectedJob) return;
    setUploading(true);
    try {
      const file = files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedJob.id}/return-photo-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('pod-photos')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('pod-photos')
        .getPublicUrl(fileName);

      setReturnPhotoUrl(publicUrl);
    } catch (error) {
      console.error('Error uploading return photo:', error);
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <div className="mb-4 rounded-2xl overflow-hidden shadow-lg animate-fade-in-up">
        <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 p-1">
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-500/30">
                  <Banknote className="w-7 h-7 text-white" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white">{jobs.length}</span>
                </div>
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Cash to Deliver</p>
                <p className="text-3xl font-black text-gray-900 leading-none mt-0.5">
                  TTD ${totalCash.toLocaleString()}
                </p>
              </div>
              <div className="p-2 bg-amber-100 rounded-xl">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
              </div>
            </div>

            <div className="bg-amber-100/80 border border-amber-300 rounded-xl p-3 mb-3">
              <p className="text-xs font-semibold text-amber-900">
                You are holding cash that must be returned. You cannot accept new jobs until all cash is delivered back.
              </p>
            </div>

            <div className="space-y-2">
              {jobs.map((job) => (
                <button
                  key={job.id}
                  onClick={() => handleStartReturn(job)}
                  className="w-full p-3 bg-white border-2 border-amber-200 hover:border-amber-400 rounded-xl transition-all flex items-center justify-between group active:scale-[0.98]"
                >
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-lg font-bold text-amber-700">TTD ${(job.cash_to_return_amount || 0).toLocaleString()}</p>
                    <p className="text-xs text-gray-600 truncate">Return to: {job.pickup_location_text}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-semibold text-amber-700 group-hover:text-amber-800">
                      Return Cash
                    </span>
                    <ArrowRight className="w-4 h-4 text-amber-500 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {selectedJob && (
        <CashReturnModal
          job={selectedJob}
          step={step}
          setStep={setStep}
          returnSignatureUrl={returnSignatureUrl}
          setReturnSignatureUrl={setReturnSignatureUrl}
          returnPhotoUrl={returnPhotoUrl}
          confirming={confirming}
          uploading={uploading}
          isDrawing={isDrawing}
          setIsDrawing={setIsDrawing}
          hasDrawn={hasDrawn}
          setHasDrawn={setHasDrawn}
          sigCanvasRef={sigCanvasRef}
          fileInputRef={fileInputRef}
          onClose={handleClose}
          onConfirm={handleConfirmReturn}
          onUploadPhoto={handleUploadPhoto}
        />
      )}
    </>
  );
}

interface CashReturnModalProps {
  job: CashReturnJob;
  step: 'amount' | 'sender_sign' | 'confirm';
  setStep: (step: 'amount' | 'sender_sign' | 'confirm') => void;
  returnSignatureUrl: string | null;
  setReturnSignatureUrl: (url: string | null) => void;
  returnPhotoUrl: string | null;
  confirming: boolean;
  uploading: boolean;
  isDrawing: boolean;
  setIsDrawing: (val: boolean) => void;
  hasDrawn: boolean;
  setHasDrawn: (val: boolean) => void;
  sigCanvasRef: React.RefObject<HTMLCanvasElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onClose: () => void;
  onConfirm: () => void;
  onUploadPhoto: (files: FileList) => void;
}

function CashReturnModal({
  job,
  step,
  setStep,
  returnSignatureUrl,
  setReturnSignatureUrl,
  returnPhotoUrl,
  confirming,
  uploading,
  isDrawing,
  setIsDrawing,
  hasDrawn,
  setHasDrawn,
  sigCanvasRef,
  fileInputRef,
  onClose,
  onConfirm,
  onUploadPhoto
}: CashReturnModalProps) {
  const amount = job.cash_to_return_amount || 0;

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
  }, [sigCanvasRef]);

  useEffect(() => {
    if (step === 'sender_sign' && !returnSignatureUrl) {
      const timer = setTimeout(initCanvas, 50);
      return () => clearTimeout(timer);
    }
  }, [step, returnSignatureUrl, initCanvas]);

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
    setReturnSignatureUrl(dataUrl);
    setStep('confirm');
  };

  const stepIndicator = (
    <div className="flex items-center gap-1 px-6 py-3 bg-green-50 border-b border-green-100">
      <div className={`flex items-center gap-1.5 ${step === 'amount' ? 'text-green-700 font-bold' : 'text-green-600'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 'amount' ? 'bg-green-600 text-white' : 'bg-green-500 text-white'
        }`}>
          {step === 'amount' ? '1' : <CheckCircle className="w-3.5 h-3.5" />}
        </div>
        <span className="text-xs">Amount</span>
      </div>
      <div className="flex-1 h-px bg-gray-300 mx-1" />
      <div className={`flex items-center gap-1.5 ${
        step === 'sender_sign' ? 'text-green-700 font-bold' : step === 'confirm' ? 'text-green-600' : 'text-gray-400'
      }`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 'sender_sign' ? 'bg-green-600 text-white' : step === 'confirm' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
        }`}>
          {step === 'confirm' ? <CheckCircle className="w-3.5 h-3.5" /> : '2'}
        </div>
        <span className="text-xs">Sign</span>
      </div>
      <div className="flex-1 h-px bg-gray-300 mx-1" />
      <div className={`flex items-center gap-1.5 ${step === 'confirm' ? 'text-green-700 font-bold' : 'text-gray-400'}`}>
        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
          step === 'confirm' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'
        }`}>3</div>
        <span className="text-xs">Confirm</span>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 z-10">
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-5 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Banknote className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Cash Return</h3>
                <p className="text-xs text-white/80">
                  {step === 'amount' && 'Review amount to return'}
                  {step === 'sender_sign' && 'Hand device to job creator to sign'}
                  {step === 'confirm' && 'Review and confirm return'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
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
              <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                <p className="text-xs text-green-700 font-medium mb-1">Amount to Return</p>
                <p className="text-3xl font-black text-green-700">
                  TTD ${amount.toLocaleString()}
                </p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <ArrowRight className="w-4 h-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-1">Return Location</p>
                    <p className="text-sm text-gray-600">{job.pickup_location_text}</p>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-left">
                <p className="text-xs text-green-900 font-semibold mb-1">What happens next:</p>
                <ul className="text-xs text-green-800 space-y-1">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    Hand the cash to the job creator
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    Get their signature to confirm receipt
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    Confirm return to complete the process
                  </li>
                </ul>
              </div>

              <button
                onClick={() => setStep('sender_sign')}
                className="w-full py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
              >
                Next: Get Job Creator Signature <ArrowRight className="w-5 h-5" />
              </button>
            </>
          )}

          {step === 'sender_sign' && (
            <>
              <div className="bg-white rounded-xl p-3 border border-green-200 text-center mb-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-0.5">Cash Amount</p>
                <p className="text-2xl font-black text-gray-900">TTD ${amount.toLocaleString()}</p>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-left">
                <p className="text-xs text-green-900 font-semibold mb-1">By signing below, the job creator confirms:</p>
                <ul className="text-xs text-green-800 space-y-0.5">
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    Received TTD ${amount.toLocaleString()} in cash from the driver
                  </li>
                  <li className="flex items-start gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 mt-0.5 flex-shrink-0" />
                    The amount is correct
                  </li>
                </ul>
              </div>

              {returnSignatureUrl ? (
                <div className="space-y-3">
                  <div className="p-3 bg-green-50 rounded-xl border-2 border-green-300">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-bold text-green-800">Signature Captured</span>
                    </div>
                    <img src={returnSignatureUrl} alt="Signature" className="h-16 w-auto mx-auto bg-white rounded-lg p-1" />
                  </div>
                  <button
                    onClick={() => setReturnSignatureUrl(null)}
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
                {returnSignatureUrl && (
                  <button
                    onClick={() => setStep('confirm')}
                    className="flex-1 py-3 px-4 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20"
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
                    <p className="text-xs text-green-700">Job creator signed and confirmed receipt</p>
                  </div>
                </div>

                <div className="bg-white rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Amount Returned</span>
                    <span className="text-xl font-bold text-gray-900">TTD ${amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>Return Location</span>
                    <span className="truncate max-w-[200px] font-medium text-gray-700">{job.pickup_location_text}</span>
                  </div>
                  <div className="pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-500 mb-1">Job Creator Signature</p>
                    <img src={returnSignatureUrl!} alt="Signature" className="h-12 w-auto" />
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-xl border-2 ${
                returnPhotoUrl ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-gray-600" />
                    <span className="font-medium text-sm text-gray-800">Return Photo (Optional)</span>
                  </div>
                  {returnPhotoUrl && <CheckCircle className="w-5 h-5 text-green-500" />}
                </div>
                <p className="text-xs text-gray-600 mb-3">
                  Photo of cash handover for added security
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      onUploadPhoto(e.target.files);
                    }
                  }}
                  className="hidden"
                />
                {returnPhotoUrl && (
                  <div className="mb-3 p-2 bg-white rounded-lg border border-green-200">
                    <img src={returnPhotoUrl} alt="Return" className="h-24 w-auto mx-auto rounded" />
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
                    <><Camera className="w-4 h-4" /> {returnPhotoUrl ? 'Retake Photo' : 'Take Photo'}</>
                  )}
                </button>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <Shield className="w-4 h-4 text-green-700 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-green-800">
                    By confirming, you acknowledge returning TTD ${amount.toLocaleString()} in cash
                    to the job creator. This completes the cash handling for this delivery.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('sender_sign')}
                  className="py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold transition-all hover:border-gray-300"
                >
                  Back
                </button>
                <button
                  onClick={onConfirm}
                  disabled={confirming}
                  className="flex-1 py-4 px-6 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-300 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20 disabled:shadow-none"
                >
                  {confirming ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Confirming...</>
                  ) : (
                    <><CheckCircle className="w-5 h-5" /> Confirm Cash Returned</>
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
