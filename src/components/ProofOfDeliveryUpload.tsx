import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Camera, Upload, X, CheckCircle2, AlertCircle, Loader2, FileCheck } from 'lucide-react';
import { requiresPhoto, requiresESignature } from '../lib/jobRoute';

interface ProofOfDeliveryUploadProps {
  jobId: string;
  podRequired: string | null;
  onComplete?: () => void;
  readOnly?: boolean;
}

interface PODData {
  id: string;
  job_id: string;
  required_type: string;
  status: string;
  photo_urls: string[];
  signature_image_url: string | null;
  signed_by_name: string | null;
  completed_at: string | null;
}

export function ProofOfDeliveryUpload({ jobId, podRequired, onComplete, readOnly = false }: ProofOfDeliveryUploadProps) {
  const [podData, setPodData] = useState<PODData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  const needsPhoto = requiresPhoto(podRequired);
  const needsSignature = requiresESignature(podRequired);

  useEffect(() => {
    loadPODData();
  }, [jobId]);

  const loadPODData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('proof_of_delivery')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      if (error) throw error;

      // If no POD record exists and POD is required, create one
      if (!data && podRequired && podRequired !== 'NONE') {
        const podStatus = podRequired === 'NONE' ? 'NOT_REQUIRED' : 'REQUIRED';
        const { data: newPod, error: createError } = await supabase
          .from('proof_of_delivery')
          .insert({
            job_id: jobId,
            required_type: podRequired,
            status: podStatus
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating POD record:', createError);
        } else {
          setPodData(newPod);
        }
      } else {
        setPodData(data);
      }
    } catch (err: any) {
      console.error('Error loading POD data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setPhotoFiles(prev => [...prev, ...files]);

    files.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviews(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotoFiles(prev => prev.filter((_, i) => i !== index));
    setPhotoPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    if (photoFiles.length === 0) {
      setError('Please select at least one photo');
      return false;
    }

    setUploading(true);
    setError('');

    try {
      const uploadedUrls: string[] = [];

      for (let i = 0; i < photoFiles.length; i++) {
        const file = photoFiles[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${jobId}/${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('pod-photos')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('pod-photos')
          .getPublicUrl(fileName);

        uploadedUrls.push(publicUrl);
      }

      const allPhotoUrls = [...(podData?.photo_urls || []), ...uploadedUrls];

      const { error: updateError } = await supabase
        .from('proof_of_delivery')
        .update({
          photo_urls: allPhotoUrls,
          status: needsSignature ? 'PENDING' : 'COMPLETED',
          completed_at: needsSignature ? null : new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('job_id', jobId);

      if (updateError) throw updateError;

      await loadPODData();
      setPhotoFiles([]);
      setPhotoPreviews([]);

      if (onComplete && !needsSignature) {
        onComplete();
      }

      return true;
    } catch (err: any) {
      console.error('Error uploading photos:', err);
      setError(err.message);
      return false;
    } finally {
      setUploading(false);
    }
  };

  const getSignedUrl = async (photoUrl: string) => {
    try {
      const path = photoUrl.split('/pod-photos/')[1];
      if (!path) return photoUrl;

      const { data, error } = await supabase.storage
        .from('pod-photos')
        .createSignedUrl(path, 3600);

      if (error) throw error;
      return data.signedUrl;
    } catch (err) {
      console.error('Error getting signed URL:', err);
      return photoUrl;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!podData || podData.required_type === 'NONE') {
    return null;
  }

  const hasPhotos = podData.photo_urls && podData.photo_urls.length > 0;
  const hasSignature = !!podData.signature_image_url;
  const isCompleted = podData.status === 'COMPLETED';

  return (
    <div className="border-2 border-teal-200 rounded-xl overflow-hidden">
      <div className="p-4 bg-gradient-to-r from-teal-50 to-cyan-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-teal-500 rounded-full flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">Proof of Delivery</h3>
              <p className="text-sm text-gray-600">
                {isCompleted ? 'Completed' : 'Required'}
              </p>
            </div>
          </div>
          {isCompleted && (
            <CheckCircle2 className="w-6 h-6 text-green-600" />
          )}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Photo Section */}
        {needsPhoto && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-blue-600" />
              <h4 className="font-semibold text-gray-900">Photo Proof</h4>
              {hasPhotos && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>

            {hasPhotos && (
              <div className="grid grid-cols-2 gap-2">
                {podData.photo_urls.map((url, index) => (
                  <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-gray-200">
                    <img
                      src={url}
                      alt={`POD Photo ${index + 1}`}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={async () => {
                        const signedUrl = await getSignedUrl(url);
                        window.open(signedUrl, '_blank');
                      }}
                    />
                  </div>
                ))}
              </div>
            )}

            {!readOnly && !isCompleted && (
              <>
                {photoPreviews.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {photoPreviews.map((preview, index) => (
                      <div key={index} className="relative aspect-square rounded-lg overflow-hidden border-2 border-blue-200">
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removePhoto(index)}
                          className="absolute top-2 right-2 p-1 bg-red-500 rounded-full text-white hover:bg-red-600 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:bg-blue-50 transition-colors">
                  <Upload className="w-8 h-8 text-blue-600 mb-2" />
                  <span className="text-sm font-medium text-blue-600">
                    {hasPhotos ? 'Add more photos' : 'Upload photos'}
                  </span>
                  <span className="text-xs text-gray-500 mt-1">
                    Click to select photos
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoSelect}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>

                {photoFiles.length > 0 && (
                  <button
                    onClick={uploadPhotos}
                    disabled={uploading}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5" />
                        Upload {photoFiles.length} photo{photoFiles.length > 1 ? 's' : ''}
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Signature Section */}
        {needsSignature && (
          <div className="space-y-3 pt-3 border-t-2 border-gray-200">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-purple-600" />
              <h4 className="font-semibold text-gray-900">E-Signature</h4>
              {hasSignature && <CheckCircle2 className="w-5 h-5 text-green-600" />}
            </div>

            {hasSignature ? (
              <div className="p-4 bg-green-50 border-2 border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-700">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">Signature collected</span>
                </div>
                {podData.signed_by_name && (
                  <p className="text-sm text-gray-600 mt-1">
                    Signed by: {podData.signed_by_name}
                  </p>
                )}
              </div>
            ) : (
              <div className="p-4 bg-amber-50 border-2 border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">Signature awaiting collection</span>
                </div>
                <p className="text-sm text-gray-600">
                  The courier will capture the recipient's e-signature upon delivery. This can be done on any device.
                </p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-medium">{error}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
