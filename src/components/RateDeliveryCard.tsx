import { useState, useEffect } from 'react';
import { Star, Check, Loader2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RateDeliveryCardProps {
  jobId: string;
  providerId: string;
  providerName: string;
  providerType: 'courier' | 'trucking_company';
  vehicleInfo?: string;
  raterUserId: string;
  raterAccountType: 'customer' | 'retail' | 'business';
  onRatingSubmitted?: () => void;
  onNotification?: (message: string, type: 'success' | 'info' | 'warning') => void;
}

interface ExistingRating {
  id: string;
  stars: number;
  comment: string | null;
  tags: string[] | null;
  created_at: string;
}

const QUICK_TAGS = [
  'On time',
  'Careful with cargo',
  'Good communication',
  'Professional'
];

export function RateDeliveryCard({
  jobId,
  providerId,
  providerName,
  providerType,
  vehicleInfo,
  raterUserId,
  raterAccountType,
  onRatingSubmitted,
  onNotification
}: RateDeliveryCardProps) {
  const [loading, setLoading] = useState(true);
  const [existingRating, setExistingRating] = useState<ExistingRating | null>(null);
  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    checkExistingRating();
  }, [jobId]);

  const checkExistingRating = async () => {
    try {
      const { data, error } = await supabase
        .from('provider_ratings')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setExistingRating(data);
      }
    } catch (error) {
      console.error('Error checking existing rating:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmitRating = async () => {
    if (stars === 0) {
      onNotification?.('Please select a star rating', 'warning');
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-rating`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          job_id: jobId,
          rater_account_type: raterAccountType,
          stars,
          comment: comment.trim() || null,
          tags: selectedTags.length > 0 ? selectedTags : null
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit rating');
      }

      onNotification?.('Thanks for your feedback!', 'success');
      await checkExistingRating();
      onRatingSubmitted?.();
    } catch (error: any) {
      console.error('Error submitting rating:', error);

      const errorMessage = error.message || 'Failed to submit rating';

      if (errorMessage.includes('already rated')) {
        onNotification?.('You have already rated this delivery', 'warning');
        await checkExistingRating();
      } else if (errorMessage.includes('Only the job owner')) {
        onNotification?.('Only the job owner can rate this delivery', 'warning');
      } else if (errorMessage.includes('completed')) {
        onNotification?.('Can only rate completed deliveries', 'warning');
      } else {
        onNotification?.(errorMessage, 'warning');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (dismissed) {
    return null;
  }

  if (existingRating) {
    return (
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-sm border border-green-200 p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
            <Check className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              Thanks! You rated {providerName}
            </h3>
            <div className="flex items-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`w-5 h-5 ${
                    i <= existingRating.stars
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              ))}
              <span className="text-sm font-medium text-gray-700 ml-1">
                {existingRating.stars} {existingRating.stars === 1 ? 'star' : 'stars'}
              </span>
            </div>
            {existingRating.comment && (
              <p className="text-sm text-gray-700 mb-3 italic">
                "{existingRating.comment}"
              </p>
            )}
            {existingRating.tags && existingRating.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {existingRating.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-green-100 text-green-700 text-xs rounded-full border border-green-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            Rate your delivery
          </h3>
          <p className="text-sm text-gray-600">
            How was your experience with {providerName}?
            {vehicleInfo && <span className="text-gray-500"> • {vehicleInfo}</span>}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rating <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setStars(i)}
                onMouseEnter={() => setHoveredStar(i)}
                onMouseLeave={() => setHoveredStar(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-8 h-8 ${
                    i <= (hoveredStar || stars)
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-gray-300'
                  }`}
                />
              </button>
            ))}
            {stars > 0 && (
              <span className="text-sm font-medium text-gray-700 ml-2">
                {stars} {stars === 1 ? 'star' : 'stars'}
              </span>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Quick feedback (optional)
          </label>
          <div className="flex flex-wrap gap-2">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleToggleTag(tag)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${
                  selectedTags.includes(tag)
                    ? 'bg-blue-100 border-blue-300 text-blue-700'
                    : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Comment (optional)
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value.slice(0, 500))}
            placeholder="Share more details about your experience..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
          <div className="flex justify-end mt-1">
            <span className="text-xs text-gray-500">
              {comment.length}/500
            </span>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSubmitRating}
            disabled={submitting || stars === 0}
            className="flex-1 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Rating'
            )}
          </button>
          <button
            onClick={() => setDismissed(true)}
            disabled={submitting}
            className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
