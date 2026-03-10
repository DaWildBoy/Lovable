import { useState, useEffect } from 'react';
import { X, Gavel, DollarSign, Users, TrendingDown, Shield } from 'lucide-react';

const STORAGE_KEY = 'moveme_seen_auction_info';

interface AuctionInfoPopupProps {
  userId: string;
  onDismiss?: () => void;
}

export function AuctionInfoPopup({ userId, onDismiss }: AuctionInfoPopupProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (onDismiss) {
      setVisible(true);
      return;
    }
    const key = `${STORAGE_KEY}_${userId}`;
    const seen = localStorage.getItem(key);
    if (!seen) {
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, [userId, onDismiss]);

  const dismiss = () => {
    localStorage.setItem(`${STORAGE_KEY}_${userId}`, 'true');
    setVisible(false);
    onDismiss?.();
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />

      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden animate-scale-in">
        <div className="relative bg-gradient-to-br from-orange-500 via-amber-500 to-yellow-500 px-6 pt-8 pb-6 text-center">
          <button
            onClick={dismiss}
            className="absolute top-3 right-3 p-1.5 text-white/70 hover:text-white transition-colors rounded-full hover:bg-white/15"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 border border-white/30">
            <Gavel className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-1.5">Auction-Style Job Listing</h2>
          <p className="text-sm text-white/80 leading-relaxed">
            A smarter way to get the best deal on your delivery
          </p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-4.5 h-4.5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Set Your Budget</p>
              <p className="text-xs text-gray-500 leading-relaxed">Post your job with a starting price or budget that works for you.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
              <Users className="w-4.5 h-4.5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Couriers Compete for You</p>
              <p className="text-xs text-gray-500 leading-relaxed">Multiple couriers see your job and submit their best offers to win your delivery.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center flex-shrink-0">
              <TrendingDown className="w-4.5 h-4.5 text-orange-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Pick the Best Offer</p>
              <p className="text-xs text-gray-500 leading-relaxed">Compare bids, check courier ratings, and choose the offer that suits you best.</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0">
              <Shield className="w-4.5 h-4.5 text-teal-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Save Money</p>
              <p className="text-xs text-gray-500 leading-relaxed">Competition drives prices down -- you often pay less than a fixed-price listing.</p>
            </div>
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={dismiss}
            className="w-full py-3 px-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-amber-600 transition-all shadow-md active:scale-[0.98]"
          >
            Got It
          </button>
        </div>
      </div>
    </div>
  );
}
