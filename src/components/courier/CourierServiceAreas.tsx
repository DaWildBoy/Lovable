import { useState } from 'react';
import { X, MapPin, Info } from 'lucide-react';

interface CourierServiceAreasProps {
  open: boolean;
  onClose: () => void;
}

interface Zone {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

const INITIAL_ZONES: Zone[] = [
  { id: 'nw', name: 'North West', description: 'Port of Spain, Diego Martin, Maraval', active: true },
  { id: 'ewc', name: 'East-West Corridor', description: 'Arima, Tunapuna, Curepe, St. Augustine', active: true },
  { id: 'central', name: 'Central', description: 'Chaguanas, Couva, Cunupia', active: false },
  { id: 'south', name: 'South', description: 'San Fernando, Point Fortin, Siparia', active: false },
  { id: 'tobago', name: 'Tobago', description: 'Scarborough, Crown Point, Plymouth', active: false },
];

export function CourierServiceAreas({ open, onClose }: CourierServiceAreasProps) {
  const [zones, setZones] = useState<Zone[]>(INITIAL_ZONES);

  if (!open) return null;

  const activeCount = zones.filter((z) => z.active).length;

  const toggleZone = (id: string) => {
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, active: !z.active } : z)));
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-slide-up">
      <header className="flex-shrink-0 bg-moveme-blue-900 text-white">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center">
              <MapPin className="w-4.5 h-4.5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Preferred Work Zones</h1>
              <p className="text-xs text-white/50 mt-0.5">
                {activeCount} zone{activeCount !== 1 ? 's' : ''} active
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-50">
        <div className="max-w-lg mx-auto p-4 space-y-3">
          <div className="bg-moveme-blue-50 border border-moveme-blue-200 rounded-2xl p-3.5 flex items-start gap-3">
            <Info className="w-4 h-4 text-moveme-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-moveme-blue-800 leading-relaxed">
              You will only receive push notifications for jobs matching your active zones and vehicle
              class.
            </p>
          </div>

          {zones.map((zone) => (
            <div
              key={zone.id}
              className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
                zone.active ? 'border-emerald-200 ring-1 ring-emerald-50' : 'border-gray-100'
              }`}
            >
              <div className="p-4 flex items-center gap-3">
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    zone.active ? 'bg-emerald-50' : 'bg-slate-50'
                  }`}
                >
                  <MapPin
                    className={`w-4 h-4 ${zone.active ? 'text-emerald-600' : 'text-slate-400'}`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{zone.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{zone.description}</p>
                </div>
                <button
                  onClick={() => toggleZone(zone.id)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors flex-shrink-0 ${
                    zone.active ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}
                  role="switch"
                  aria-checked={zone.active}
                >
                  <span
                    className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      zone.active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          ))}

          <div className="pt-2 pb-6">
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              Expand your coverage to receive more job opportunities. Changes take effect immediately.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
