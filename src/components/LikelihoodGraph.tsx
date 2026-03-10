import { TrendingUp, TrendingDown, Minus, Target } from 'lucide-react';

interface LikelihoodGraphProps {
  score: number;
  label: string;
  breakdown: {
    distance: number;
    cargo: number;
    urgency: number;
    price: number;
  };
  priceRecommendation: {
    low: number;
    mid: number;
    high: number;
  };
  customerOffer: number;
}

export function LikelihoodGraph({
  score,
  label,
  priceRecommendation,
  customerOffer
}: LikelihoodGraphProps) {
  const getScoreColor = () => {
    if (score >= 70) return { bg: 'from-green-500 to-green-600', text: 'text-green-600', light: 'bg-green-50' };
    if (score >= 50) return { bg: 'from-yellow-500 to-yellow-600', text: 'text-yellow-600', light: 'bg-yellow-50' };
    return { bg: 'from-red-500 to-red-600', text: 'text-red-600', light: 'bg-red-50' };
  };

  const getIcon = () => {
    if (score >= 70) return <TrendingUp className="w-6 h-6 text-white" />;
    if (score >= 50) return <Minus className="w-6 h-6 text-white" />;
    return <TrendingDown className="w-6 h-6 text-white" />;
  };

  const getLikelihoodMessage = () => {
    if (score >= 80) return "Excellent! Your job is highly attractive to couriers.";
    if (score >= 70) return "Very Good! Your job has strong appeal to couriers.";
    if (score >= 60) return "Good! Your job should attract courier interest.";
    if (score >= 50) return "Fair. You may want to adjust your offer for better results.";
    return "Low likelihood. Consider increasing your offer to attract couriers.";
  };

  const colors = getScoreColor();

  return (
    <div className="bg-white border-2 border-gray-200 rounded-xl p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2 mb-6">
          <Target className="w-5 h-5 text-gray-700" />
          <h3 className="text-lg font-bold text-gray-900">Booking Likelihood</h3>
        </div>

        <div className={`${colors.light} rounded-xl p-6 mb-6`}>
          <div className="flex items-center gap-6">
            <div className={`flex-shrink-0 w-16 h-16 rounded-full bg-gradient-to-br ${colors.bg} flex items-center justify-center shadow-lg`}>
              {getIcon()}
            </div>
            <div className="flex-1">
              <div className="flex items-baseline gap-3 mb-2">
                <span className={`text-4xl font-bold ${colors.text}`}>{score}%</span>
                <span className="text-lg font-semibold text-gray-700">{label}</span>
              </div>
              <p className="text-sm text-gray-600">{getLikelihoodMessage()}</p>
            </div>
          </div>
        </div>

        <div className="relative w-full h-8 bg-gray-200 rounded-full overflow-hidden mb-2">
          <div
            className={`h-full bg-gradient-to-r ${colors.bg} transition-all duration-500 ease-out shadow-inner`}
            style={{ width: `${score}%` }}
          />
        </div>

        <div className="flex justify-between text-xs text-gray-500 px-1">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h4 className="text-sm font-bold text-gray-900 mb-4">Price Comparison</h4>

        <div className="space-y-3">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Recommended Range</span>
              <span className="text-base font-bold text-gray-900">
                TTD ${priceRecommendation.low} - ${priceRecommendation.high}
              </span>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border-2 border-blue-300">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-blue-900">Your Offer</span>
              <span className="text-xl font-bold text-blue-900">TTD ${customerOffer}</span>
            </div>
          </div>

          {customerOffer <= 0 && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <p className="text-sm font-medium text-red-900">
                Price must be greater than $0. Please enter a valid offer to attract couriers.
              </p>
            </div>
          )}

          {customerOffer > 0 && customerOffer < 10 && (
            <div className="p-4 bg-red-50 border-2 border-red-300 rounded-lg">
              <p className="text-sm font-medium text-red-900">
                Your offer is too low (minimum $10 TTD). Couriers are unlikely to accept this job.
              </p>
            </div>
          )}

          {customerOffer >= 10 && customerOffer < priceRecommendation.low && (
            <div className="p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
              <p className="text-sm font-medium text-amber-900">
                Your offer is below the recommended range. Increasing it may improve your chances of getting a courier quickly.
              </p>
            </div>
          )}

          {customerOffer >= priceRecommendation.low && customerOffer < priceRecommendation.mid && (
            <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg">
              <p className="text-sm font-medium text-blue-900">
                Your offer is within the recommended range and should attract courier interest.
              </p>
            </div>
          )}

          {customerOffer >= priceRecommendation.mid && (
            <div className="p-4 bg-green-50 border-2 border-green-300 rounded-lg">
              <p className="text-sm font-medium text-green-900">
                Excellent! Your competitive offer is likely to attract couriers quickly.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
