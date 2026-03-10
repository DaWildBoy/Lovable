import { Home, MapPin, ChevronRight } from 'lucide-react';

interface Props {
  homeBaseText: string | null;
  homeBaseLat: number | null;
  homeBaseLng: number | null;
  onNavigate: (path: string) => void;
}

export function CourierHomeBase({ homeBaseText, homeBaseLat, homeBaseLng, onNavigate }: Props) {
  if (!homeBaseText) {
    return (
      <button
        onClick={() => onNavigate('/courier/profile')}
        className="bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-300 p-4 w-full text-left transition-all duration-200 active:scale-[0.98] group"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-blue-50 transition-colors">
            <Home className="w-5 h-5 text-gray-400 group-hover:text-blue-500 transition-colors" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-700 group-hover:text-gray-900 transition-colors">Set Your Home Base</p>
            <p className="text-xs text-gray-500">Get backhaul job suggestions on your way home</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={() => onNavigate('/courier/profile')}
      className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 w-full text-left hover:shadow-elevated transition-all duration-200 active:scale-[0.98] group"
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gradient-to-br from-teal-400 to-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <Home className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Home Base</p>
          <p className="text-sm font-semibold text-gray-900 truncate">{homeBaseText}</p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg flex-shrink-0 border border-emerald-100">
          <MapPin className="w-3 h-3" />
          <span className="font-semibold">Set</span>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors flex-shrink-0" />
      </div>
    </button>
  );
}
