import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Gift,
  Copy,
  Check,
  Users,
  Clock,
  DollarSign,
  Share2,
  Sparkles,
  ArrowRight,
  Send,
} from 'lucide-react';

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
  const [showToast, setShowToast] = useState(false);

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
    setShowToast(true);
    setTimeout(() => setCopied(false), 2200);
    setTimeout(() => setShowToast(false), 2500);
    trackInvite();
  };

  const shareWhatsApp = () => {
    if (!stats) return;
    const text =
      role === 'customer'
        ? `Join me on MoveMe! Use my code ${stats.code} to get $50 in delivery credit on your first delivery. Download now!`
        : `Join the MoveMe driver network! Use my code ${stats.code} when you sign up. Complete 3 jobs and we both earn rewards!`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
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
          <div className="card p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-6 bg-gray-100 rounded-lg w-40" />
              <div className="h-24 bg-gray-100 rounded-xl" />
              <div className="h-14 bg-gray-100 rounded-xl" />
              <div className="grid grid-cols-3 gap-3">
                <div className="h-16 bg-gray-100 rounded-xl" />
                <div className="h-16 bg-gray-100 rounded-xl" />
                <div className="h-16 bg-gray-100 rounded-xl" />
              </div>
            </div>
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
          <div className="relative bg-gradient-to-br from-moveme-blue-900 via-moveme-blue-800 to-moveme-blue-950 p-6 pb-8 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-moveme-blue-400/10 rounded-full translate-y-1/2 -translate-x-1/4 blur-2xl" />

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/25">
                  <Gift className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">
                    Invite & Earn
                  </h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                    <span className="text-xs font-medium text-orange-300">
                      {isCustomer ? 'Referral Rewards' : 'Convoy Bonus'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                {isCustomer ? (
                  <p className="text-sm text-blue-100 leading-relaxed">
                    <span className="text-white font-semibold">Give $50 in Delivery Credit, Get $50.</span>{' '}
                    Invite businesses or friends to MoveMe. When they complete their first delivery, you both get rewarded.
                  </p>
                ) : (
                  <p className="text-sm text-blue-100 leading-relaxed">
                    <span className="text-white font-semibold">The Convoy Bonus.</span>{' '}
                    Invite a fellow driver. When they complete 3 jobs, you earn a 0% Platform Fee Voucher for your next heavy haul.
                  </p>
                )}
                <div className="flex items-center gap-1.5 mt-3 text-orange-300">
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {isCustomer ? 'Unlimited referrals' : 'Stack your vouchers'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 space-y-4 bg-gradient-to-b from-gray-50/80 to-white">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 px-0.5">
                Your Referral Code
              </p>
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 via-moveme-blue-500/20 to-orange-400/20 rounded-2xl blur-sm opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-moveme-blue-900 rounded-2xl p-5 flex items-center justify-between border-2 border-moveme-blue-800 group-hover:border-orange-400/50 transition-colors duration-300">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-orange-400 animate-pulse-soft" />
                    <span className="font-mono text-2xl sm:text-3xl font-black tracking-[0.2em] text-white">
                      {stats.code}
                    </span>
                  </div>
                  <button
                    onClick={copyCode}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 ${
                      copied
                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25'
                        : 'bg-white/15 text-white hover:bg-white/25 border border-white/20'
                    }`}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={copyCode}
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-moveme-blue-600 hover:bg-moveme-blue-700 text-white font-semibold rounded-xl transition-all duration-200 active:scale-[0.97] shadow-soft hover:shadow-elevated"
              >
                <Share2 className="w-4.5 h-4.5" />
                <span className="text-sm">Share Link</span>
              </button>
              <button
                onClick={shareWhatsApp}
                className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-[#25D366] hover:bg-[#1fb855] text-white font-bold rounded-xl transition-all duration-200 active:scale-[0.97] shadow-lg shadow-[#25D366]/25 hover:shadow-[#25D366]/40"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                <span className="text-sm">WhatsApp</span>
              </button>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2.5 px-0.5">
                Your Referrals
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                <ReferralStatCard
                  icon={<Send className="w-4 h-4" />}
                  label="Invites Sent"
                  value={stats.invitesSent}
                  color="blue"
                />
                <ReferralStatCard
                  icon={<Clock className="w-4 h-4" />}
                  label="Pending"
                  value={stats.pendingSignups}
                  color="orange"
                />
                <ReferralStatCard
                  icon={<DollarSign className="w-4 h-4" />}
                  label="Earned"
                  value={`$${stats.totalEarned}`}
                  color="green"
                />
              </div>
            </div>
          </div>
        </div>

        {showToast && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-fade-in-up">
            <div className="flex items-center gap-2 px-5 py-3 bg-moveme-blue-900 text-white rounded-full shadow-elevated text-sm font-semibold">
              <Check className="w-4 h-4 text-emerald-400" />
              Code copied to clipboard
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReferralStatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: 'blue' | 'orange' | 'green';
}) {
  const colorMap = {
    blue: {
      bg: 'bg-moveme-blue-50',
      icon: 'text-moveme-blue-600',
      value: 'text-moveme-blue-900',
    },
    orange: {
      bg: 'bg-orange-50',
      icon: 'text-orange-500',
      value: 'text-orange-900',
    },
    green: {
      bg: 'bg-emerald-50',
      icon: 'text-emerald-600',
      value: 'text-emerald-900',
    },
  };

  const c = colorMap[color];

  return (
    <div className={`${c.bg} rounded-xl p-3 text-center transition-all duration-200 hover:scale-[1.02]`}>
      <div className={`${c.icon} flex justify-center mb-1.5`}>{icon}</div>
      <p className={`text-lg font-bold ${c.value}`}>{value}</p>
      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">
        {label}
      </p>
    </div>
  );
}
