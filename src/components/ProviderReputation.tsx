import { Star, Package } from 'lucide-react';

interface ProviderReputationProps {
  ratingAverage?: number | null;
  ratingCount?: number | null;
  completedDeliveries?: number | null;
  size?: 'sm' | 'md' | 'lg';
  showDeliveries?: boolean;
  inline?: boolean;
}

export function ProviderReputation({
  ratingAverage,
  ratingCount,
  completedDeliveries,
  size = 'md',
  showDeliveries = true,
  inline = false
}: ProviderReputationProps) {
  const hasRating = ratingAverage !== null && ratingAverage !== undefined && ratingCount !== null && ratingCount !== undefined;
  const hasDeliveries = completedDeliveries !== null && completedDeliveries !== undefined;

  const starSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4';
  const textSize = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-base' : 'text-sm';
  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-4 h-4' : 'w-3.5 h-3.5';

  // If no data at all, show "New provider"
  if (!hasRating && !hasDeliveries) {
    return (
      <div className={`flex items-center gap-1 text-gray-400 ${inline ? 'inline-flex' : ''}`}>
        <Star className={starSize} />
        <span className={textSize}>New provider</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${inline ? 'inline-flex' : ''}`}>
      {hasRating && (
        <div className="flex items-center gap-1">
          <div className="flex items-center">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`${starSize} ${
                  i <= Math.round(ratingAverage || 0)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-gray-300'
                }`}
              />
            ))}
          </div>
          <span className={`${textSize} font-medium text-gray-700`}>
            {(ratingAverage || 0).toFixed(1)}
          </span>
          <span className={`${textSize} text-gray-500`}>
            ({ratingCount || 0})
          </span>
        </div>
      )}

      {hasRating && hasDeliveries && showDeliveries && (
        <span className="text-gray-300">•</span>
      )}

      {hasDeliveries && showDeliveries && (
        <div className="flex items-center gap-1 text-gray-600">
          <Package className={iconSize} />
          <span className={`${textSize}`}>
            {completedDeliveries || 0} {(completedDeliveries || 0) === 1 ? 'delivery' : 'deliveries'}
          </span>
        </div>
      )}
    </div>
  );
}
