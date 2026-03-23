import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Gift, Copy, Check, Send, Clock, DollarSign } from 'lucide-react';

interface ReferralDashboardProps {
  userId: string;
  role: 'customer' | 'courier';
}

interface ReferralStats {
  code: string;
  invitesSent: number;
  pendingSignups: number;
  totalEarned: number;
}

export function ReferralDashboard({ userId, role }: ReferralDashboardProps) {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralStats();
  }, [userId]);

  const generateCode = (uid: string) => {
    const hash = uid.replace(/-/g, '').substring(0, 4).toUpperCase();
    return `CM-${hash}-TT`;
  };

  const fetchReferralStats = async () => {
    try {
      const { data: referrals } = await supabase
        .from('customer_referrals')
        .select('id, status, reward_amount_ttd, invites_sent')
        .eq('referrer_user_id', userId);

      const code = generateCode(userId);
      const rows = referrals || [];
      const invitesSent = rows.reduce((sum, r) => sum + (r.invites_sent || 0), 0);
      const pendingSignups = rows.filter((r) => r.status === 'pending').length;
      const totalEarned = rows
        .filter((r) => r.status === 'completed')
        .reduce((sum, r) => sum + (Number(r.reward_amount_ttd) || 0), 0);

      setStats({ code, invitesSent, pendingSignups, totalEarned });
    } catch {
      setStats({ code: generateCode(userId), invitesSent: 0, pendingSignups: 0, totalEarned: 0 });
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!stats) return;
    try {
      await navigator.clipboard.writeText(stats.code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = stats.code;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
    trackInvite();
  };

  const shareWhatsApp = () => {
    if (!stats) return;
    const text =
      role === 'customer'
        ? `Join me on MoveMe! Use my code ${stats.code} to get $50 in delivery credit on your first delivery. Download now!`
        : `Join the MoveMe driver network! Use my code ${stats.code} when you sign up. Complete 3 jobs and we both earn rewards!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
    trackInvite();
  };

  const trackInvite = async () => {
    if (!stats) return;
    const { data: existing } = await supabase
      .from('customer_referrals')
      .select('id, invites_sent')
      .eq('referrer_user_id', userId)
      .eq('referral_code', stats.code)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('customer_referrals')
        .update({ invites_sent: (existing.invites_sent || 0) + 1 })
        .eq('id', existing.id);
    } else {
      await supabase.from('customer_referrals').insert({
        referrer_user_id: userId,
        referral_code: stats.code,
        invites_sent: 1,
        status: 'pending',
      });
    }

    setStats((prev) =>
      prev ? { ...prev, invitesSent: prev.invitesSent + 1 } : prev
    );
  };

  if (loading) {
    return (
      <div className="px-4">
        <div className="max-w-4xl mx-auto">
          <div className="card p-4 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-28 mb-3" />
            <div className="h-10 bg-gray-100 rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const isCustomer = role === 'customer';

  return (
    <div className="px-4">
      <div className="max-w-4xl mx-auto">
        <div className="card overflow-hidden animate-fade-in">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-moveme-blue-50 rounded-lg flex items-center justify-center">
                  <Gift className="w-4 h-4 text-moveme-blue-600" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Invite & Earn</h3>
                  <p className="text-[11px] text-gray-500">
                    {isCustomer ? 'Give $50, Get $50' : 'Convoy Bonus'}
                  </p>
                </div>
              </div>
            </div>

            <p className="text-xs text-gray-500 leading-relaxed mb-3">
              {isCustomer
                ? 'Invite friends to MoveMe. When they complete their first delivery, you both get $50 credit.'
                : 'Invite a fellow driver. When they complete 3 jobs, you earn a 0% Platform Fee Voucher.'}
            </p>

            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 flex items-center justify-center">
                <span className="font-mono text-base font-bold tracking-widest text-moveme-blue-800">
                  {stats.code}
                </span>
              </div>
              <button
                onClick={copyCode}
                className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-lg text-xs font-semibold transition-all duration-200 active:scale-95 ${
                  copied
                    ? 'bg-emerald-500 text-white'
                    : 'bg-moveme-blue-600 text-white hover:bg-moveme-blue-700'
                }`}
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <button
              onClick={shareWhatsApp}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#1fb855] text-white font-semibold text-sm rounded-lg transition-all duration-200 active:scale-[0.98]"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Share via WhatsApp
            </button>
          </div>

          <div className="border-t border-gray-100 grid grid-cols-3 divide-x divide-gray-100">
            <div className="py-2.5 px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
                <Send className="w-3 h-3" />
                <span className="text-[10px] font-medium">Sent</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{stats.invitesSent}</p>
            </div>
            <div className="py-2.5 px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
                <Clock className="w-3 h-3" />
                <span className="text-[10px] font-medium">Pending</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{stats.pendingSignups}</p>
            </div>
            <div className="py-2.5 px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-400 mb-0.5">
                <DollarSign className="w-3 h-3" />
                <span className="text-[10px] font-medium">Earned</span>
              </div>
              <p className="text-sm font-bold text-gray-900">${stats.totalEarned}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
