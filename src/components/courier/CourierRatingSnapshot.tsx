import { Star, Award, ChevronRight } from 'lucide-react';

interface Props {
  ratingAverage: number;
  ratingCount: number;
  completedDeliveries: number;
  onNavigate: (path: string) => void;
}

export function CourierRatingSnapshot({ ratingAverage, ratingCount, completedDeliveries, onNavigate }: Props) {
  const displayRating = ratingAverage > 0 ? ratingAverage.toFixed(1) : '--';
  const stars = Math.round(ratingAverage);

  return (
    <button
      onClick={() => onNavigate('/courier/profile')}
      className="bg-white rounded-2xl border border-gray-100 shadow-card p-4 w-full text-left hover:shadow-elevated transition-all duration-200 active:scale-[0.98] group"
    >
      <div className="flex items-center gap-3.5">
        <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
          <div className="text-center">
            <p className="text-lg font-bold text-white leading-none">{displayRating}</p>
            <div className="flex gap-px mt-0.5 justify-center">
              {[1, 2, 3, 4, 5].map(i => (
                <Star
                  key={i}
                  className={`w-2 h-2 ${i <= stars ? 'text-white fill-white' : 'text-white/40'}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900">Your Rating</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {ratingCount > 0 ? `Based on ${ratingCount} review${ratingCount !== 1 ? 's' : ''}` : 'No reviews yet'}
          </p>
        </div>
        <div className="flex items-center gap-2.5 flex-shrink-0">
          <div className="bg-blue-50 px-3 py-2 rounded-xl text-center border border-blue-100">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-blue-600" />
              <p className="text-base font-bold text-blue-700 leading-none tabular-nums">{completedDeliveries}</p>
            </div>
            <p className="text-[9px] text-blue-500 uppercase tracking-wider mt-0.5 font-semibold">Deliveries</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-400 transition-colors" />
        </div>
      </div>
    </button>
  );
}
