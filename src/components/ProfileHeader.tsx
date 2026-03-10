import { useState, useRef } from 'react';
import { User, CheckCircle, AlertCircle, Camera, Loader2, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ProfileHeaderProps {
  fullName: string;
  email: string;
  accountType: string;
  isVerified: boolean;
  profilePictureUrl?: string | null;
  userId?: string;
  uploadField?: string;
  onUploadComplete?: (url: string) => void;
  companyName?: string | null;
  hideVerificationBadge?: boolean;
}

export function ProfileHeader({
  fullName,
  email,
  accountType,
  isVerified,
  profilePictureUrl,
  userId,
  uploadField,
  onUploadComplete,
  companyName,
  hideVerificationBadge = false,
}: ProfileHeaderProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canUpload = !!userId && !!uploadField && !!onUploadComplete;

  const getAccountTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'customer': 'Customer Account',
      'courier': 'Courier Account',
      'retail': 'Retail Account',
      'company': 'Company Account',
      'haulage': 'Courier Account',
      'company_driver': 'Company Driver',
    };
    return labels[type] || 'User Account';
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !userId || !uploadField || !onUploadComplete) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Image must be less than 5MB');
      return;
    }

    setUploadError(null);
    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-logo-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadErr } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, { upsert: true });

      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(filePath);

      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ [uploadField]: publicUrl })
        .eq('id', userId);

      if (updateErr) throw updateErr;

      onUploadComplete(publicUrl);
    } catch (err) {
      console.error('Error uploading logo:', err);
      setUploadError('Failed to upload. Please try again.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="gradient-header px-4 py-8 md:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-4">
          <div
            className={`relative w-18 h-18 rounded-2xl bg-white/15 flex items-center justify-center flex-shrink-0 overflow-hidden backdrop-blur-sm border border-white/20 ${canUpload ? 'cursor-pointer group' : ''}`}
            style={{ width: '72px', height: '72px' }}
            onClick={() => canUpload && fileInputRef.current?.click()}
          >
            {profilePictureUrl ? (
              <img src={profilePictureUrl} alt={fullName} className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-white/90" />
            )}
            {canUpload && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {uploading ? (
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </div>
            )}
          </div>
          {canUpload && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              disabled={uploading}
              className="hidden"
            />
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold mb-0.5 tracking-tight">{fullName}</h1>
            <p className="text-white/60 text-sm mb-2.5">{email}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs px-2.5 py-1 bg-white/15 backdrop-blur-sm rounded-lg font-medium border border-white/10">
                {getAccountTypeLabel(accountType)}
              </span>
              {!hideVerificationBadge && (
                isVerified ? (
                  <span className="flex items-center gap-1 text-xs text-success-300 font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    Verified
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-warning-300 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Unverified
                  </span>
                )
              )}
            </div>
            {companyName && (
              <div className="flex items-center gap-1.5 mt-2">
                <Building2 className="w-3.5 h-3.5 text-white/50" />
                <span className="text-xs text-white/70 font-medium">{companyName}</span>
              </div>
            )}
            {uploadError && (
              <p className="text-xs text-error-300 mt-1.5">{uploadError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
