import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Gift, Copy, Check, Users, DollarSign } from 'lucide-react';

interface Props {
  userId: string;
}

interface ReferralData {
  code: string;
  totalReferred: number;
  totalEarned: number;
}

export function CustomerProfileReferral({ userId }: Props) {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, [userId]);

  const generateCode = (uid: string) => {
    const prefix = 'MOVEME';
    const suffix = uid.substring(0, 6).toUpperCase();
    return `${prefix}-${suffix}`;
  };

  const fetchReferralData = async () => {
    try {
      const { data: referrals } = await supabase
        .from('customer_referrals')
        .select('id, status, reward_amount_ttd')
        .eq('referrer_user_id', userId);

      const code = generateCode(userId);
      const totalReferred = (referrals || []).filter((r) => r.status === 'completed').length;
      const totalEarned = (referrals || []).reduce((sum, r) => sum + (Number(r.reward_amount_ttd) || 0), 0);

      setData({ code, totalReferred, totalEarned });
    } catch (err) {
      console.error('Error fetching referral data:', err);
      setData({ code: generateCode(userId), totalReferred: 0, totalEarned: 0 });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = data.code;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="px-4">
        <div className="max-w-4xl mx-auto">
          <div className="card p-6 animate-pulse">
            <div className="h-5 bg-gray-100 rounded w-32 mb-4" />
            <div className="h-12 bg-gray-100 rounded mb-4" />
            <div className="h-8 bg-gray-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Refer & Earn</h2>
        </div>
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-br from-moveme-blue-600 to-moveme-blue-700 p-5 text-white">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
                <Gift className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-sm">Share your code</p>
                <p className="text-white/70 text-xs">Earn rewards when friends sign up</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/15">
                <p className="font-mono text-lg font-bold tracking-wider text-center">{data.code}</p>
              </div>
              <button
                onClick={copyCode}
                className={`p-3 rounded-xl transition-all border ${
                  copied
                    ? 'bg-emerald-500 border-emerald-400'
                    : 'bg-white/15 border-white/20 hover:bg-white/25 active:scale-95'
                }`}
              >
                {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-gray-100">
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-1">
                <Users className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Referred</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{data.totalReferred}</p>
            </div>
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-1.5 text-gray-400 mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span className="text-xs font-medium">Earned</span>
              </div>
              <p className="text-lg font-bold text-gray-900">${data.totalEarned.toFixed(0)}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
