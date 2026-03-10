import { MapPin, ChevronDown, ChevronUp, Lock } from 'lucide-react';
import { useState } from 'react';

interface JobBannerProps {
  pickup: string;
  dropoff: string;
  status: string;
  jobCompleted: boolean;
}

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-amber-100 text-amber-700' },
  assigned: { label: 'Assigned', color: 'bg-blue-100 text-blue-700' },
  on_way_to_pickup: { label: 'En Route to Pickup', color: 'bg-cyan-100 text-cyan-700' },
  cargo_collected: { label: 'Cargo Collected', color: 'bg-teal-100 text-teal-700' },
  in_transit: { label: 'In Transit', color: 'bg-sky-100 text-sky-700' },
  in_progress: { label: 'In Progress', color: 'bg-sky-100 text-sky-700' },
  delivered: { label: 'Delivered', color: 'bg-green-100 text-green-700' },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600' },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

export function JobBanner({ pickup, dropoff, status, jobCompleted }: JobBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const statusInfo = statusLabels[status] || { label: status, color: 'bg-gray-100 text-gray-600' };

  return (
    <button
      onClick={() => setExpanded(!expanded)}
      className={`w-full text-left transition-all ${
        jobCompleted
          ? 'bg-gray-50 border-b border-gray-200'
          : 'bg-blue-50/50 border-b border-blue-100'
      }`}
    >
      <div className="px-4 py-2 flex items-center gap-2">
        {jobCompleted && <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
            {jobCompleted && (
              <span className="text-[10px] text-gray-400">Chat closed - read only</span>
            )}
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="px-4 pb-2.5 space-y-1.5">
          <div className="flex items-start gap-2">
            <div className="mt-0.5">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/20" />
            </div>
            <p className="text-xs text-gray-600 truncate flex-1">{pickup}</p>
          </div>
          <div className="flex items-start gap-2">
            <div className="mt-0.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-red-500/20" />
            </div>
            <p className="text-xs text-gray-600 truncate flex-1">{dropoff}</p>
          </div>
        </div>
      )}
    </button>
  );
}
