import { Building2 } from 'lucide-react';

interface AssignedCompanyCardProps {
  companyName: string;
  companyLogoUrl?: string | null;
  isCompleted?: boolean;
}

export function AssignedCompanyCard({
  companyName,
  companyLogoUrl,
  isCompleted = false,
}: AssignedCompanyCardProps) {
  const title = isCompleted ? 'Delivered by' : 'Assigned Haulage Company';

  const getInitials = (name: string) => {
    const words = name.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Building2 className="w-5 h-5 text-blue-600" />
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>

      <div className="flex items-center gap-3">
        {companyLogoUrl ? (
          <img
            src={companyLogoUrl}
            alt={companyName}
            className="w-12 h-12 rounded-full object-cover border-2 border-blue-300"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center border-2 border-blue-300">
            <span className="text-white font-bold text-sm">
              {getInitials(companyName)}
            </span>
          </div>
        )}

        <div className="flex-1">
          <p className="font-semibold text-gray-900">{companyName}</p>
          <p className="text-xs text-gray-600">Haulage Company</p>
        </div>
      </div>
    </div>
  );
}
