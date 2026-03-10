import { Building2, ChevronRight, CheckCircle, AlertCircle } from 'lucide-react';
import { Database } from '../../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface Props {
  profile: Profile;
  onNavigate: (path: string) => void;
}

function getCompletionPercentage(profile: Profile): number {
  const fields = [
    profile.company_name,
    profile.full_name,
    profile.phone,
    profile.business_type,
    (profile as any).retail_primary_contact_name,
    (profile as any).retail_business_phone,
    (profile as any).retail_business_email,
  ];

  const filled = fields.filter(f => f && String(f).trim() !== '').length;
  return Math.round((filled / fields.length) * 100);
}

export function RetailProfileCard({ profile, onNavigate }: Props) {
  const completion = getCompletionPercentage(profile);
  const isComplete = completion >= 100;

  return (
    <button
      onClick={() => onNavigate('/business/profile')}
      className="card p-4 text-left hover:shadow-elevated transition-all active:scale-[0.99] w-full group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 bg-moveme-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-moveme-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">
            {profile.company_name || 'Your Business'}
          </p>
          <p className="text-[11px] text-gray-400">
            {profile.business_type || 'Retail Business'}
          </p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0 mt-1" />
      </div>

      {isComplete ? (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-success-50 rounded-lg">
          <CheckCircle className="w-3.5 h-3.5 text-success-600" />
          <span className="text-[11px] text-success-700 font-semibold">Profile complete</span>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-warning-500" />
              <span className="text-[11px] text-warning-600 font-semibold">Complete your profile</span>
            </div>
            <span className="text-[11px] font-bold text-gray-700">{completion}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-warning-400 rounded-full transition-all duration-500"
              style={{ width: `${completion}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
