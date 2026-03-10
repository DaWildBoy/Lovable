import { useState, useRef } from 'react';
import { X, Camera, Upload, MapPinOff, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react';

interface BadPinOverrideModalProps {
  onConfirm: (photoFile: File) => void;
  onCancel: () => void;
  distanceMeters: number;
}

export function BadPinOverrideModal({ onConfirm, onCancel, distanceMeters }: BadPinOverrideModalProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = () => {
    if (!selectedFile) return;
    setSubmitting(true);
    onConfirm(selectedFile);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <MapPinOff className="w-5 h-5 text-amber-700" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Not at the pin?</h3>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900 mb-1">
                  You are {distanceMeters}m from the map pin
                </p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  If you are at the correct address but the customer's map pin is wrong,
                  you can force arrival by verifying your location with a photo.
                </p>
              </div>
            </div>
          </div>

          {preview ? (
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden border-2 border-green-300 shadow-sm">
                <img src={preview} alt="Location verification" className="w-full h-48 object-cover" />
                <div className="absolute top-2 right-2 bg-green-600 text-white px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Photo captured
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                  className="flex-1 py-3 border-2 border-gray-200 hover:border-gray-300 rounded-xl font-semibold text-gray-700 transition-all text-sm"
                >
                  Retake
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="flex-1 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold transition-all text-sm shadow-lg shadow-amber-500/20 disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <MapPinOff className="w-4 h-4" />
                      Override &amp; Arrive
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                Verify via Photo
              </p>
              <button
                onClick={() => cameraRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold transition-all shadow-lg shadow-blue-600/20 active:scale-[0.98]"
              >
                <Camera className="w-5 h-5" />
                Take Photo of Location
              </button>

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex items-center justify-center gap-3 py-3.5 border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl font-semibold text-gray-700 transition-all text-sm"
              >
                <Upload className="w-4 h-4" />
                Upload from Gallery
              </button>

              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          <p className="text-[11px] text-gray-400 text-center leading-relaxed">
            Your current GPS coordinates and photo will be logged for admin review.
            This override will be flagged on the job record.
          </p>
        </div>
      </div>
    </div>
  );
}
