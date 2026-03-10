import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Award, Star, Zap, Crown, TrendingUp } from 'lucide-react';

interface Props {
  userId: string;
}

interface LoyaltyData {
  completedDeliveries: number;
  tier: string;
  nextTier: string | null;
  deliveriesUntilNext: number;
  perks: string[];
}

const tiers = [
  { name: 'Bronze', min: 0, max: 9, icon: Award, color: 'from-amber-600 to-amber-700', textColor: 'text-amber-600', bgColor: 'bg-amber-50', perks: ['Standard support'] },
  { name: 'Silver', min: 10, max: 29, icon: Star, color: 'from-gray-400 to-gray-500', textColor: 'text-gray-500', bgColor: 'bg-gray-100', perks: ['Priority support', '5% off service fees'] },
  { name: 'Gold', min: 30, max: 74, icon: Zap, color: 'from-yellow-500 to-amber-500', textColor: 'text-yellow-600', bgColor: 'bg-yellow-50', perks: ['Priority support', '10% off service fees', 'Early access to features'] },
  { name: 'Platinum', min: 75, max: Infinity, icon: Crown, color: 'from-sky-600 to-blue-700', textColor: 'text-sky-600', bgColor: 'bg-sky-50', perks: ['Dedicated support', '15% off service fees', 'Early access to features', 'Priority matching'] },
];

export function CustomerProfileLoyalty({ userId }: Props) {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLoyalty();
  }, [userId]);

  const fetchLoyalty = async () => {
    try {
      const { count } = await supabase
        .from('jobs')
        .select('id', { count: 'exact', head: true })
        .eq('customer_user_id', userId)
        .in('status', ['completed', 'delivered']);

      const completedDeliveries = count || 0;
      const currentTier = tiers.find((t) => completedDeliveries >= t.min && completedDeliveries <= t.max) || tiers[0];
      const currentTierIndex = tiers.indexOf(currentTier);
      const nextTier = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;

      setData({
        completedDeliveries,
        tier: currentTier.name,
        nextTier: nextTier?.name || null,
        deliveriesUntilNext: nextTier ? nextTier.min - completedDeliveries : 0,
        perks: currentTier.perks,
      });
    } catch (err) {
      console.error('Error fetching loyalty:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4">
        <div className="max-w-4xl mx-auto">
          <div className="card p-6 animate-pulse">
            <div className="h-5 bg-gray-100 rounded w-32 mb-4" />
            <div className="h-16 bg-gray-100 rounded mb-4" />
            <div className="h-3 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const currentTierObj = tiers.find((t) => t.name === data.tier) || tiers[0];
  const currentTierIndex = tiers.indexOf(currentTierObj);
  const nextTierObj = currentTierIndex < tiers.length - 1 ? tiers[currentTierIndex + 1] : null;
  const TierIcon = currentTierObj.icon;

  const progressPercent = nextTierObj
    ? ((data.completedDeliveries - currentTierObj.min) / (nextTierObj.min - currentTierObj.min)) * 100
    : 100;

  return (
    <div className="px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Loyalty Rewards</h2>
        </div>
        <div className="card overflow-hidden">
          <div className={`bg-gradient-to-br ${currentTierObj.color} p-5 text-white`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                  <TierIcon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-lg">{data.tier} Member</p>
                  <p className="text-white/70 text-xs">{data.completedDeliveries} deliveries completed</p>
                </div>
              </div>
            </div>

            {nextTierObj && (
              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="text-white/70">{data.deliveriesUntilNext} more to {nextTierObj.name}</span>
                  <span className="font-medium">{Math.round(progressPercent)}%</span>
                </div>
                <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(progressPercent, 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Perks</p>
            <div className="space-y-2">
              {data.perks.map((perk) => (
                <div key={perk} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full ${currentTierObj.bgColor} flex items-center justify-center`}>
                    <TrendingUp className={`w-3 h-3 ${currentTierObj.textColor}`} />
                  </div>
                  <span className="text-sm text-gray-700">{perk}</span>
                </div>
              ))}
            </div>
          </div>

          {nextTierObj && (
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
              <div className="flex items-center gap-2">
                <nextTierObj.icon className={`w-4 h-4 ${nextTierObj.textColor}`} />
                <p className="text-xs text-gray-500">
                  Complete <span className="font-semibold text-gray-700">{data.deliveriesUntilNext}</span> more deliveries to unlock <span className="font-semibold text-gray-700">{nextTierObj.name}</span> perks
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
