import { TrendingUp, Navigation, DollarSign, ArrowRight } from 'lucide-react';

interface BackhaulMatch {
  job: {
    id: string;
    pickup_location_text: string;
    dropoff_location_text: string;
    price_ttd?: number;
    total_price?: number;
    customer_offer_ttd?: number;
    cargo_size_category?: string;
  };
  distanceToPickup: number;
  distanceFromDropoff: number;
  estimatedFuelCost: number;
  netProfit: number;
}

interface BackhaulOpportunityAlertProps {
  match: BackhaulMatch;
  onAccept: (jobId: string) => void;
}

export function BackhaulOpportunityAlert({ match, onAccept }: BackhaulOpportunityAlertProps) {
  return (
    <div className="bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-xl">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Return Trip Available!</h3>
            <p className="text-white/90 text-sm">Earn on your way back</p>
          </div>
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-5 h-5 text-white" />
          <span className="font-semibold">Route Match</span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-green-300 mt-1.5 flex-shrink-0" />
            <span className="font-medium">{match.job.pickup_location_text}</span>
          </div>
          <div className="ml-1 flex items-center gap-1 text-white/60">
            <ArrowRight className="w-3 h-3" />
            <span className="text-xs">{match.distanceToPickup.toFixed(1)}km from you</span>
          </div>
          <div className="flex items-start gap-2">
            <div className="w-2 h-2 rounded-full bg-red-300 mt-1.5 flex-shrink-0" />
            <span className="font-medium">{match.job.dropoff_location_text}</span>
          </div>
          <div className="ml-1 flex items-center gap-1 text-white/60">
            <ArrowRight className="w-3 h-3" />
            <span className="text-xs">{match.distanceFromDropoff.toFixed(1)}km from home</span>
          </div>
        </div>
      </div>

      <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-5 h-5 text-green-300" />
          <span className="font-semibold">Earnings Breakdown</span>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/80">Job Payment:</span>
            <span className="font-medium">TTD ${Number(match.job.customer_offer_ttd || match.job.total_price || match.job.price_ttd || 0)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/80">Est. Fuel Cost:</span>
            <span className="font-medium">-TTD ${match.estimatedFuelCost}</span>
          </div>
          <div className="border-t border-white/20 pt-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-lg">Net Profit:</span>
              <span className="font-bold text-2xl text-green-300">
                TTD ${match.netProfit}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 bg-green-400/20 rounded-lg p-2 text-center">
          <p className="text-xs font-medium">
            Earn this instead of driving home empty!
          </p>
        </div>
      </div>

      {match.job.cargo_size_category && (
        <div className="mb-4 text-sm">
          <span className="bg-white/20 px-3 py-1 rounded-full">
            {match.job.cargo_size_category}
          </span>
        </div>
      )}

      <button
        onClick={() => onAccept(match.job.id)}
        className="w-full bg-white text-emerald-700 font-bold py-3 px-6 rounded-xl hover:bg-emerald-50 transition-all transform hover:scale-[1.02] shadow-lg"
      >
        View & Accept Return Load
      </button>

      <p className="text-xs text-white/60 text-center mt-3">
        This job is near your current location and heads toward home
      </p>
    </div>
  );
}
