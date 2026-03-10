import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface VerificationPageProps {
  onNavigate: (path: string) => void;
}

export function VerificationPage({ onNavigate }: VerificationPageProps) {
  const { profile } = useAuth();

  const getProfilePath = () => {
    if (!profile) return '/';
    if (profile.role === 'customer') return '/customer/profile';
    if (profile.role === 'courier') return '/courier/profile';
    if (profile.role === 'business') {
      return profile.business_type === 'haulage' ? '/courier/profile' : '/business/profile';
    }
    return '/';
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8">
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate(getProfilePath())}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-2"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Profile
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Verification Status</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Account Verified</h2>
              <p className="text-gray-600">
                Your account has been verified and is active. You have full access to all features.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-900 mb-4">Verification Details</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700">Email verified</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700">Phone number verified</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-700">Profile complete</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">Need additional verification?</p>
              <p>Contact support if you need to verify additional information or documents.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
