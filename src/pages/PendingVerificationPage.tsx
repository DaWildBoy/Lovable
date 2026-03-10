import { useState, useEffect, useRef } from 'react';
import { Clock, ShieldCheck, LogOut, Mail, Phone, FileText, Building2, Camera, Upload, Loader2, AlertCircle, X, RotateCcw, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface PendingVerificationPageProps {
  type: 'courier' | 'haulage';
}

export function PendingVerificationPage({ type }: PendingVerificationPageProps) {
  const { signOut, profile, user } = useAuth();
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [licenseStatus, setLicenseStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [showReupload, setShowReupload] = useState(false);
  const [reuploadFront, setReuploadFront] = useState<File | null>(null);
  const [reuploadBack, setReuploadBack] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const isCourier = type === 'courier';
  const isCompanyDriver = !!(profile as Record<string, unknown>)?.is_company_driver;

  useEffect(() => {
    if (isCompanyDriver && user) {
      const linkedCompanyId = (profile as Record<string, unknown>)?.linked_company_id as string | null;
      if (linkedCompanyId) {
        supabase
          .from('profiles')
          .select('company_name')
          .eq('id', linkedCompanyId)
          .maybeSingle()
          .then(({ data }) => {
            if (data?.company_name) setCompanyName(data.company_name);
          });
      }

      supabase
        .from('haulage_drivers')
        .select('license_upload_status, license_rejection_reason')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setLicenseStatus(data.license_upload_status);
            setRejectionReason(data.license_rejection_reason);
          }
        });
    }
  }, [isCompanyDriver, user, profile]);

  const handleFileSelect = (file: File | null, side: 'front' | 'back') => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (side === 'front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setReuploadFront(file);
      setFrontPreview(url);
    } else {
      if (backPreview) URL.revokeObjectURL(backPreview);
      setReuploadBack(file);
      setBackPreview(url);
    }
  };

  const handleReupload = async () => {
    if (!reuploadFront || !reuploadBack || !user) return;
    setUploading(true);
    setUploadError('');

    try {
      const frontExt = reuploadFront.name.split('.').pop();
      const backExt = reuploadBack.name.split('.').pop();
      const frontPath = `${user.id}/license_front_${Date.now()}.${frontExt}`;
      const backPath = `${user.id}/license_back_${Date.now()}.${backExt}`;

      const { error: fe } = await supabase.storage.from('driver-id-documents').upload(frontPath, reuploadFront);
      if (fe) throw fe;

      const { error: be } = await supabase.storage.from('driver-id-documents').upload(backPath, reuploadBack);
      if (be) throw be;

      const { error: ue } = await supabase
        .from('haulage_drivers')
        .update({
          license_front_url: frontPath,
          license_back_url: backPath,
          license_upload_status: 'pending',
          license_rejection_reason: null,
        })
        .eq('user_id', user.id);

      if (ue) throw ue;

      setLicenseStatus('pending');
      setRejectionReason(null);
      setShowReupload(false);
      setUploadSuccess(true);
      setTimeout(() => setUploadSuccess(false), 5000);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-moveme-blue-50 via-white to-moveme-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in-up">
        <div className="card p-8 text-center">
          <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-full bg-amber-50 mb-6">
            {isCompanyDriver ? (
              <Building2 className="w-10 h-10 text-amber-500" />
            ) : (
              <ShieldCheck className="w-10 h-10 text-amber-500" />
            )}
            <div className="absolute -top-1 -right-1 w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center">
              <Clock className="w-4 h-4 text-white" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
            {isCompanyDriver ? 'Awaiting Company Approval' : 'Verification In Progress'}
          </h1>

          <p className="text-gray-500 text-sm mb-6">
            {isCompanyDriver
              ? `Your request to join ${companyName || 'the company'} is pending approval.`
              : isCourier
                ? 'Your courier application is being reviewed by our team.'
                : 'Your haulage company registration is being reviewed by our team.'}
          </p>

          {isCompanyDriver && companyName && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 mb-4 flex items-center gap-2 justify-center">
              <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-800 font-medium">
                Linked to {companyName}
              </p>
            </div>
          )}

          {uploadSuccess && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-800 font-medium">
                License re-uploaded successfully. Your company will review it.
              </p>
            </div>
          )}

          {isCompanyDriver && licenseStatus === 'rejected' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-left">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-800">Driver's License Rejected</p>
                  {rejectionReason && (
                    <p className="text-sm text-red-700 mt-1">Reason: {rejectionReason}</p>
                  )}
                  <p className="text-xs text-red-600 mt-1">Please upload a new, clear photo of your driver's license.</p>
                </div>
              </div>

              {!showReupload ? (
                <button
                  onClick={() => setShowReupload(true)}
                  className="w-full py-2.5 px-4 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Camera className="w-4 h-4" />
                  Re-upload Driver's License
                </button>
              ) : (
                <div className="space-y-3 mt-3 pt-3 border-t border-red-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1.5">Front</p>
                      {frontPreview ? (
                        <div className="relative rounded-lg overflow-hidden border border-gray-200">
                          <img src={frontPreview} alt="Front" className="w-full h-24 object-cover" />
                          <button
                            onClick={() => { if (frontPreview) URL.revokeObjectURL(frontPreview); setReuploadFront(null); setFrontPreview(null); }}
                            className="absolute top-1 right-1 p-1 bg-white/90 rounded-md shadow"
                          >
                            <X className="w-3 h-3 text-gray-600" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => frontRef.current?.click()}
                          className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-400 transition-colors"
                        >
                          <Camera className="w-5 h-5 text-gray-400" />
                          <span className="text-[10px] text-gray-500">Tap to capture</span>
                        </button>
                      )}
                      <input ref={frontRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'front')} className="hidden" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-700 mb-1.5">Back</p>
                      {backPreview ? (
                        <div className="relative rounded-lg overflow-hidden border border-gray-200">
                          <img src={backPreview} alt="Back" className="w-full h-24 object-cover" />
                          <button
                            onClick={() => { if (backPreview) URL.revokeObjectURL(backPreview); setReuploadBack(null); setBackPreview(null); }}
                            className="absolute top-1 right-1 p-1 bg-white/90 rounded-md shadow"
                          >
                            <X className="w-3 h-3 text-gray-600" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => backRef.current?.click()}
                          className="w-full h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-400 transition-colors"
                        >
                          <Camera className="w-5 h-5 text-gray-400" />
                          <span className="text-[10px] text-gray-500">Tap to capture</span>
                        </button>
                      )}
                      <input ref={backRef} type="file" accept="image/*" capture="environment" onChange={(e) => handleFileSelect(e.target.files?.[0] || null, 'back')} className="hidden" />
                    </div>
                  </div>

                  {uploadError && (
                    <p className="text-xs text-red-600">{uploadError}</p>
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowReupload(false)}
                      className="flex-1 py-2 px-3 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleReupload}
                      disabled={uploading || !reuploadFront || !reuploadBack}
                      className="flex-1 py-2 px-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      {uploading ? 'Uploading...' : 'Submit'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mb-6 text-left space-y-3">
            <p className="text-sm font-semibold text-amber-800">What happens next?</p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5">
                <FileText className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700">
                  {isCompanyDriver
                    ? 'Your company reviews and approves your driver account'
                    : isCourier
                      ? 'We verify your vehicle details and uploaded documents'
                      : 'We review your company information and business documents'}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700">
                  {isCompanyDriver
                    ? 'You will be notified once your company approves your account'
                    : 'You will be notified by email once your account is approved'}
                </p>
              </div>
              <div className="flex items-start gap-2.5">
                <Clock className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-700">
                  {isCompanyDriver
                    ? 'Contact your company if approval takes longer than expected'
                    : 'This typically takes 1-2 business days'}
                </p>
              </div>
            </div>
          </div>

          {profile?.email && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-gray-400 uppercase tracking-wider font-medium mb-2">Signed in as</p>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-moveme-blue-100 flex items-center justify-center">
                  <span className="text-sm font-semibold text-moveme-blue-600">
                    {(profile.first_name || profile.email)?.[0]?.toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {profile.first_name} {profile.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{profile.email}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {!isCompanyDriver && (
              <a
                href="mailto:support@movemett.com"
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                <Phone className="w-4 h-4" />
                Contact Support
              </a>
            )}

            <button
              onClick={() => window.location.reload()}
              className="btn-primary w-full py-3 text-sm"
            >
              {isCompanyDriver ? 'Check Approval Status' : 'Check Verification Status'}
            </button>

            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-gray-400 hover:text-gray-600 text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
