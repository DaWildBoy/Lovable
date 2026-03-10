import { ArrowLeft } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { CustomerProfilePreferences } from '../../components/customer/CustomerProfilePreferences';

interface Props {
  onNavigate: (path: string) => void;
}

export function CustomerPreferencesPage({ onNavigate }: Props) {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-8 animate-fade-in-up">
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <button
            onClick={() => onNavigate('/customer/profile')}
            className="flex items-center gap-1.5 text-moveme-blue-600 hover:text-moveme-blue-700 font-medium mb-3 text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Profile
          </button>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Delivery Preferences</h1>
          <p className="text-sm text-gray-500 mt-1">Set your default options for new deliveries</p>
        </div>
      </div>

      <div className="py-6">
        <CustomerProfilePreferences userId={user.id} onNavigate={onNavigate} />
      </div>
    </div>
  );
}
