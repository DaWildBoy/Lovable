import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Loader2, Upload, Check, Building2, CheckCircle, AlertCircle, Truck, User, ArrowLeft, Camera, CreditCard, RotateCcw, X } from 'lucide-react';

type CourierType = 'independent' | 'company' | null;

export function CourierOnboardingPage() {
  const { user, signOut } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [courierType, setCourierType] = useState<CourierType>(null);

  const [vehicleType, setVehicleType] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');

  const [companyCode, setCompanyCode] = useState('');
  const [companyLinkStatus, setCompanyLinkStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [linkedCompanyName, setLinkedCompanyName] = useState('');

  const [driversLicense, setDriversLicense] = useState<File | null>(null);
  const [vehicleRegistration, setVehicleRegistration] = useState<File | null>(null);
  const [insurance, setInsurance] = useState<File | null>(null);

  const [licenseFront, setLicenseFront] = useState<File | null>(null);
  const [licenseBack, setLicenseBack] = useState<File | null>(null);
  const [licenseFrontPreview, setLicenseFrontPreview] = useState<string | null>(null);
  const [licenseBackPreview, setLicenseBackPreview] = useState<string | null>(null);
  const licenseFrontRef = useRef<HTMLInputElement>(null);
  const licenseBackRef = useRef<HTMLInputElement>(null);

  const isCompanyFlow = courierType === 'company';

  const getProgressSteps = () => {
    if (isCompanyFlow) {
      return [
        { label: 'Company Code', step: 1 },
        { label: "Driver's License", step: 2 },
      ];
    }
    return [
      { label: 'Courier Type', step: 1 },
      { label: 'Vehicle Info', step: 2 },
      { label: 'Documents', step: 3 },
    ];
  };

  const getDocStep = () => 3;
  const getFinishedStep = () => (isCompanyFlow ? 3 : 4);

  const handleLicenseFileSelect = (file: File | null, side: 'front' | 'back') => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    if (side === 'front') {
      if (licenseFrontPreview) URL.revokeObjectURL(licenseFrontPreview);
      setLicenseFront(file);
      setLicenseFrontPreview(url);
    } else {
      if (licenseBackPreview) URL.revokeObjectURL(licenseBackPreview);
      setLicenseBack(file);
      setLicenseBackPreview(url);
    }
  };

  const clearLicenseFile = (side: 'front' | 'back') => {
    if (side === 'front') {
      if (licenseFrontPreview) URL.revokeObjectURL(licenseFrontPreview);
      setLicenseFront(null);
      setLicenseFrontPreview(null);
    } else {
      if (licenseBackPreview) URL.revokeObjectURL(licenseBackPreview);
      setLicenseBack(null);
      setLicenseBackPreview(null);
    }
  };

  const handleCompanyLinkAndCourierCreate = async () => {
    setError('');
    setLoading(true);

    try {
      const { data: linkResult, error: linkError } = await supabase.rpc(
        'link_courier_to_company',
        { p_company_code: companyCode.trim().toUpperCase(), p_courier_user_id: user!.id }
      );

      if (linkError) {
        setCompanyLinkStatus('error');
        setError('Failed to verify company code. Please try again.');
        setLoading(false);
        return;
      }

      const result = linkResult as { success: boolean; error?: string; company_name?: string };
      if (!result.success) {
        setCompanyLinkStatus('error');
        setError(result.error || 'Invalid company code. Please check the code and try again.');
        setLoading(false);
        return;
      }

      setCompanyLinkStatus('success');
      setLinkedCompanyName(result.company_name || '');

      const { data: existingCourier } = await supabase
        .from('couriers')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!existingCourier) {
        const { error: insertError } = await supabase
          .from('couriers')
          .insert({
            user_id: user!.id,
            vehicle_type: 'truck',
            vehicle_make: 'Assigned by company',
            vehicle_model: 'Assigned by company',
            vehicle_year: new Date().getFullYear(),
            vehicle_plate: 'Assigned by company',
          });

        if (insertError) throw insertError;
      }

      setStep(2);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLicenseUpload = async () => {
    setError('');

    if (!licenseFront) {
      setError('Please upload the front of your driver\'s license');
      return;
    }
    if (!licenseBack) {
      setError('Please upload the back of your driver\'s license');
      return;
    }

    setLoading(true);

    try {
      const frontExt = licenseFront.name.split('.').pop();
      const backExt = licenseBack.name.split('.').pop();
      const frontPath = `${user!.id}/license_front_${Date.now()}.${frontExt}`;
      const backPath = `${user!.id}/license_back_${Date.now()}.${backExt}`;

      const { error: frontUploadError } = await supabase.storage
        .from('driver-id-documents')
        .upload(frontPath, licenseFront);
      if (frontUploadError) throw frontUploadError;

      const { error: backUploadError } = await supabase.storage
        .from('driver-id-documents')
        .upload(backPath, licenseBack);
      if (backUploadError) throw backUploadError;

      const { error: updateError } = await supabase
        .from('haulage_drivers')
        .update({
          license_front_url: frontPath,
          license_back_url: backPath,
          license_upload_status: 'pending',
        })
        .eq('user_id', user!.id);

      if (updateError) throw updateError;

      setStep(getFinishedStep());
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while uploading your license');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: existingCourier } = await supabase
        .from('couriers')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (existingCourier) {
        const { error: updateError } = await supabase
          .from('couriers')
          .update({
            vehicle_type: vehicleType,
            vehicle_make: vehicleMake,
            vehicle_model: vehicleModel,
            vehicle_year: parseInt(vehicleYear),
            vehicle_plate: vehiclePlate,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user!.id);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('couriers')
          .insert({
            user_id: user!.id,
            vehicle_type: vehicleType,
            vehicle_make: vehicleMake,
            vehicle_model: vehicleModel,
            vehicle_year: parseInt(vehicleYear),
            vehicle_plate: vehiclePlate,
          });

        if (insertError) throw insertError;
      }

      setStep(3);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred');
      }
    } finally {
      setLoading(false);
    }
  };

  const uploadDocument = async (file: File, docType: string, courierId: string) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user!.id}/${docType}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('courier-documents')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { error: dbError } = await supabase
      .from('courier_documents')
      .insert({
        courier_id: courierId,
        doc_type: docType,
        file_path: fileName,
      });

    if (dbError) throw dbError;
  };

  const handleDocuments = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!driversLicense || !vehicleRegistration || !insurance) {
      setError('Please upload all required documents');
      return;
    }

    setLoading(true);

    try {
      const { data: courier } = await supabase
        .from('couriers')
        .select('id')
        .eq('user_id', user!.id)
        .single();

      if (!courier) throw new Error('Courier profile not found');

      await uploadDocument(driversLicense, 'drivers_license', courier.id);
      await uploadDocument(vehicleRegistration, 'vehicle_registration', courier.id);
      await uploadDocument(insurance, 'insurance', courier.id);

      setStep(getFinishedStep());
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('An error occurred while uploading documents');
      }
    } finally {
      setLoading(false);
    }
  };

  const finishedStep = getFinishedStep();
  if (step === finishedStep) {
    return (
      <div className="min-h-screen bg-moveme-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md text-center">
          <div className="inline-flex p-4 rounded-full bg-green-100 mb-6">
            <Check className="w-12 h-12 text-green-600" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {isCompanyFlow ? 'Account Linked!' : 'Application Submitted!'}
          </h1>

          <p className="text-gray-600 mb-6">
            {isCompanyFlow
              ? 'Your account has been linked and your driver\'s license has been submitted. Your company will review and approve your application.'
              : 'Thank you for completing your courier application. Our team will review your documents and verify your information.'}
          </p>

          {linkedCompanyName && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-800 font-medium">
                Linked to {linkedCompanyName}
              </p>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-700">
              {isCompanyFlow
                ? 'Your company will review your driver\'s license and approve your account. You\'ll be notified once approved.'
                : "You'll be notified via email once your account is approved. This typically takes 1-2 business days."}
            </p>
          </div>

          <button
            onClick={() => window.location.reload()}
            className="w-full py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 transition-all"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const progressSteps = getProgressSteps();
  const currentProgressIndex = progressSteps.findIndex((s) => s.step === step);

  return (
    <div className="min-h-screen bg-moveme-blue-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-2xl font-bold text-gray-900">
              Courier Verification
            </h1>
            {step === 1 && (
              <button
                onClick={() => signOut()}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-4">
            {progressSteps.map((s, i) => (
              <div
                key={s.step}
                className={`flex-1 h-2 rounded ${i <= currentProgressIndex ? 'bg-blue-600' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-sm text-gray-600">
            {progressSteps.map((s) => (
              <span key={s.step}>{s.label}</span>
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">How will you be driving?</h2>
              <p className="text-sm text-gray-500 mb-6">
                This helps us set up your account correctly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => setCourierType('independent')}
                className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                  courierType === 'independent'
                    ? 'border-blue-600 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {courierType === 'independent' && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                )}
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <User className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Independent Courier</h3>
                <p className="text-sm text-gray-500">
                  I drive on my own. I pick my own jobs, set my own schedule, and manage my earnings directly.
                </p>
              </button>

              <button
                onClick={() => setCourierType('company')}
                className={`relative p-6 rounded-xl border-2 text-left transition-all ${
                  courierType === 'company'
                    ? 'border-blue-600 bg-blue-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                {courierType === 'company' && (
                  <div className="absolute top-3 right-3">
                    <CheckCircle className="w-5 h-5 text-blue-600" />
                  </div>
                )}
                <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center mb-4">
                  <Truck className="w-6 h-6 text-teal-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">Company Driver</h3>
                <p className="text-sm text-gray-500">
                  I drive for a haulage/trucking company. My company handles pricing and payments.
                </p>
              </button>
            </div>

            {courierType === 'company' && (
              <div className="border border-gray-200 rounded-xl p-5 bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="w-4 h-4 text-gray-600" />
                  <label className="block text-sm font-semibold text-gray-800">
                    Enter Your Company Code
                  </label>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Your company should have provided you with an 8-character code. Enter it below to link your account.
                </p>
                <input
                  type="text"
                  value={companyCode}
                  onChange={(e) => {
                    setCompanyCode(e.target.value.toUpperCase());
                    setCompanyLinkStatus('idle');
                    setError('');
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono tracking-widest text-center uppercase text-lg"
                  placeholder="e.g. ABCD1234"
                  maxLength={8}
                />
                {companyLinkStatus === 'success' && (
                  <div className="mt-2 flex items-center gap-1.5 text-green-600">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">Linked to {linkedCompanyName}</span>
                  </div>
                )}
                {companyLinkStatus === 'error' && (
                  <div className="mt-2 flex items-center gap-1.5 text-amber-600">
                    <AlertCircle className="w-4 h-4" />
                    <span className="text-xs font-medium">Code not recognized. Check with your company.</span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={() => {
                if (!courierType) {
                  setError('Please select how you will be driving');
                  return;
                }
                if (courierType === 'company') {
                  if (!companyCode.trim()) {
                    setError('Please enter your company code');
                    return;
                  }
                  handleCompanyLinkAndCourierCreate();
                } else {
                  setError('');
                  setStep(2);
                }
              }}
              disabled={loading}
              className="w-full py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? 'Verifying...' : 'Continue'}
            </button>
          </div>
        )}

        {step === 2 && !isCompanyFlow && (
          <form onSubmit={handleVehicleInfo} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vehicle Type <span className="text-red-500">*</span>
              </label>
              <select
                value={vehicleType}
                onChange={(e) => setVehicleType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              >
                <option value="">Select type</option>
                <option value="car">Car</option>
                <option value="van">Van</option>
                <option value="truck">Truck</option>
                <option value="motorcycle">Motorcycle</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={vehicleMake}
                  onChange={(e) => setVehicleMake(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Toyota"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Hilux"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={vehicleYear}
                  onChange={(e) => setVehicleYear(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="2020"
                  min="1990"
                  max={new Date().getFullYear() + 1}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  License Plate <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="ABC 1234"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          </form>
        )}

        {step === 2 && isCompanyFlow && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-sm text-emerald-800 font-medium">
                Linked to {linkedCompanyName}
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="w-5 h-5 text-gray-700" />
                <h2 className="text-lg font-semibold text-gray-900">Upload Your Driver's License</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                Take a clear photo or scan of both sides of your driver's license. Your company will review this during approval.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Front of License <span className="text-red-500">*</span>
                </label>
                {licenseFrontPreview ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300 bg-gray-50">
                    <img
                      src={licenseFrontPreview}
                      alt="License front"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => licenseFrontRef.current?.click()}
                        className="p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                      >
                        <RotateCcw className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => clearLicenseFile('front')}
                        className="p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                      <p className="text-xs text-white font-medium truncate">{licenseFront?.name}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => licenseFrontRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/30 transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Camera className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <p className="text-sm text-gray-500 group-hover:text-blue-600 font-medium">
                      Tap to capture or upload
                    </p>
                    <p className="text-xs text-gray-400">Front side</p>
                  </button>
                )}
                <input
                  ref={licenseFrontRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleLicenseFileSelect(e.target.files?.[0] || null, 'front')}
                  className="hidden"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Back of License <span className="text-red-500">*</span>
                </label>
                {licenseBackPreview ? (
                  <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300 bg-gray-50">
                    <img
                      src={licenseBackPreview}
                      alt="License back"
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <button
                        type="button"
                        onClick={() => licenseBackRef.current?.click()}
                        className="p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                      >
                        <RotateCcw className="w-4 h-4 text-gray-600" />
                      </button>
                      <button
                        type="button"
                        onClick={() => clearLicenseFile('back')}
                        className="p-1.5 bg-white/90 rounded-lg shadow hover:bg-white transition-colors"
                      >
                        <X className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-2">
                      <p className="text-xs text-white font-medium truncate">{licenseBack?.name}</p>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => licenseBackRef.current?.click()}
                    className="w-full h-48 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50/30 transition-all group cursor-pointer"
                  >
                    <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center group-hover:bg-blue-100 transition-colors">
                      <Camera className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
                    </div>
                    <p className="text-sm text-gray-500 group-hover:text-blue-600 font-medium">
                      Tap to capture or upload
                    </p>
                    <p className="text-xs text-gray-400">Back side</p>
                  </button>
                )}
                <input
                  ref={licenseBackRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleLicenseFileSelect(e.target.files?.[0] || null, 'back')}
                  className="hidden"
                />
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs text-amber-800">
                Ensure the photo is clear, well-lit, and all text is readable. Blurry or unreadable images will be rejected.
              </p>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Back
              </button>
              <button
                onClick={handleLicenseUpload}
                disabled={loading || !licenseFront || !licenseBack}
                className="flex-1 py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? 'Uploading...' : 'Submit'}
              </button>
            </div>
          </div>
        )}

        {step === getDocStep() && (
          <form onSubmit={handleDocuments} className="space-y-6">
            {linkedCompanyName && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <p className="text-sm text-emerald-800 font-medium">
                  Linked to {linkedCompanyName}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Driver's License <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setDriversLicense(e.target.files?.[0] || null)}
                  className="hidden"
                  id="drivers-license"
                  required
                />
                <label htmlFor="drivers-license" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {driversLicense ? driversLicense.name : 'Click to upload'}
                  </p>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle Registration <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setVehicleRegistration(e.target.files?.[0] || null)}
                  className="hidden"
                  id="vehicle-registration"
                  required
                />
                <label htmlFor="vehicle-registration" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {vehicleRegistration ? vehicleRegistration.name : 'Click to upload'}
                  </p>
                </label>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Insurance <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition-colors">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setInsurance(e.target.files?.[0] || null)}
                  className="hidden"
                  id="insurance"
                  required
                />
                <label htmlFor="insurance" className="cursor-pointer">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    {insurance ? insurance.name : 'Click to upload'}
                  </p>
                </label>
              </div>
            </div>

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-all"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 bg-moveme-blue-600 text-white rounded-lg font-semibold hover:bg-moveme-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-5 h-5 animate-spin" />}
                {loading ? 'Uploading...' : 'Submit'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
