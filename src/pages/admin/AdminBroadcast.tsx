import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Send,
  Megaphone,
  AlertTriangle,
  Gift,
  Info,
  Radio,
  Users,
  Truck,
  Building2,
  Clock,
  CheckCircle2,
  Loader2,
  ChevronDown,
  History,
} from 'lucide-react';

interface BroadcastRecord {
  id: string;
  title: string;
  message: string;
  type: string;
  target_audience: string;
  recipients_count: number;
  created_at: string;
}

const NOTIFICATION_TYPES = [
  { value: 'announcement', label: 'Announcement', icon: Megaphone, color: 'bg-blue-100 text-blue-700', desc: 'General platform announcements' },
  { value: 'traffic_alert', label: 'Traffic Alert', icon: AlertTriangle, color: 'bg-amber-100 text-amber-700', desc: 'Road closures, traffic delays' },
  { value: 'promo', label: 'Promotion / Deal', icon: Gift, color: 'bg-emerald-100 text-emerald-700', desc: 'Holiday deals, discounts' },
  { value: 'platform_update', label: 'Platform Update', icon: Info, color: 'bg-sky-100 text-sky-700', desc: 'New features, maintenance' },
  { value: 'system_announcement', label: 'System Alert', icon: Radio, color: 'bg-red-100 text-red-700', desc: 'Urgent system-wide notices' },
];

const AUDIENCES = [
  { value: 'all', label: 'All Users', icon: Users, desc: 'Everyone on the platform' },
  { value: 'customers', label: 'Customers', icon: Users, desc: 'Individual customers' },
  { value: 'couriers', label: 'Couriers', icon: Truck, desc: 'All courier drivers' },
  { value: 'businesses', label: 'Businesses', icon: Building2, desc: 'Retail & haulage companies' },
];

const TYPE_BADGE: Record<string, { bg: string; text: string }> = {
  announcement: { bg: 'bg-blue-50', text: 'text-blue-700' },
  traffic_alert: { bg: 'bg-amber-50', text: 'text-amber-700' },
  promo: { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  platform_update: { bg: 'bg-sky-50', text: 'text-sky-700' },
  system_announcement: { bg: 'bg-red-50', text: 'text-red-700' },
};

const AUDIENCE_LABEL: Record<string, string> = {
  all: 'All Users',
  customers: 'Customers',
  couriers: 'Couriers',
  businesses: 'Businesses',
};

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
};

export function AdminBroadcast() {
  const { session } = useAuth();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('announcement');
  const [audience, setAudience] = useState('all');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [history, setHistory] = useState<BroadcastRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('broadcast_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setHistory((data || []) as BroadcastRecord[]);
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      setResult({ ok: false, msg: 'Title and message are required' });
      return;
    }

    setSending(true);
    setResult(null);
    setShowConfirm(false);

    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-broadcast-notification`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type,
          targetAudience: audience,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send notification');
      }

      setResult({ ok: true, msg: `Notification sent to ${data.recipientsCount} users` });
      setTitle('');
      setMessage('');
      setType('announcement');
      setAudience('all');
      fetchHistory();
    } catch (err) {
      setResult({ ok: false, msg: err instanceof Error ? err.message : 'Something went wrong' });
    } finally {
      setSending(false);
    }
  };

  const selectedType = NOTIFICATION_TYPES.find(t => t.value === type)!;
  const selectedAudience = AUDIENCES.find(a => a.value === audience)!;
  const canSend = title.trim().length > 0 && message.trim().length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Push Notifications</h1>
        <p className="text-sm text-gray-500 mt-1">Send broadcast notifications to users across the platform</p>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-moveme-blue-50 rounded-xl flex items-center justify-center">
                <Send className="w-5 h-5 text-moveme-blue-600" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Compose Notification</h2>
                <p className="text-xs text-gray-400">This will appear in every user's notification feed</p>
              </div>
            </div>

            <div className="p-5 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Notification Type</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {NOTIFICATION_TYPES.map((t) => {
                    const Icon = t.icon;
                    const active = type === t.value;
                    return (
                      <button
                        key={t.value}
                        onClick={() => setType(t.value)}
                        className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                          active
                            ? 'border-moveme-blue-500 bg-moveme-blue-50/50 ring-1 ring-moveme-blue-500/20'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${t.color}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-semibold truncate ${active ? 'text-moveme-blue-700' : 'text-gray-700'}`}>
                            {t.label}
                          </p>
                          <p className="text-[10px] text-gray-400 truncate">{t.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Target Audience</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AUDIENCES.map((a) => {
                    const Icon = a.icon;
                    const active = audience === a.value;
                    return (
                      <button
                        key={a.value}
                        onClick={() => setAudience(a.value)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${
                          active
                            ? 'border-moveme-blue-500 bg-moveme-blue-50/50 ring-1 ring-moveme-blue-500/20'
                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <Icon className={`w-5 h-5 ${active ? 'text-moveme-blue-600' : 'text-gray-400'}`} />
                        <p className={`text-xs font-semibold ${active ? 'text-moveme-blue-700' : 'text-gray-600'}`}>{a.label}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Heavy Traffic on Churchill-Roosevelt Highway"
                  maxLength={120}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:border-moveme-blue-500 focus:ring-2 focus:ring-moveme-blue-500/20 transition-all outline-none"
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">{title.length}/120</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g., Expect delays between Barataria and Curepe due to an accident. Consider alternate routes via Priority Bus Route."
                  maxLength={500}
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:border-moveme-blue-500 focus:ring-2 focus:ring-moveme-blue-500/20 transition-all outline-none resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1 text-right">{message.length}/500</p>
              </div>

              {result && (
                <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium ${
                  result.ok
                    ? 'bg-success-50 text-success-700 border border-success-200'
                    : 'bg-error-50 text-error-700 border border-error-200'
                }`}>
                  {result.ok ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 flex-shrink-0" />}
                  {result.msg}
                </div>
              )}

              {!showConfirm ? (
                <button
                  onClick={() => canSend && setShowConfirm(true)}
                  disabled={!canSend || sending}
                  className={`w-full flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-sm font-bold transition-all ${
                    canSend
                      ? 'bg-moveme-blue-600 text-white hover:bg-moveme-blue-700 shadow-lg shadow-moveme-blue-600/20 active:scale-[0.98]'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  <Send className="w-4 h-4" />
                  Send Notification
                </button>
              ) : (
                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 space-y-3 animate-fade-in">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-800">Confirm Broadcast</p>
                      <p className="text-xs text-amber-700 mt-1">
                        You are about to send "<span className="font-semibold">{title}</span>" to{' '}
                        <span className="font-semibold">{selectedAudience.label.toLowerCase()}</span>.
                        This cannot be undone.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-8">
                    <button
                      onClick={handleSend}
                      disabled={sending}
                      className="flex items-center gap-2 px-4 py-2.5 bg-moveme-blue-600 text-white rounded-lg text-sm font-bold hover:bg-moveme-blue-700 transition-all disabled:opacity-50"
                    >
                      {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      {sending ? 'Sending...' : 'Yes, Send Now'}
                    </button>
                    <button
                      onClick={() => setShowConfirm(false)}
                      disabled={sending}
                      className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                <History className="w-5 h-5 text-gray-500" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-gray-900">Broadcast History</h2>
                <p className="text-xs text-gray-400">Recent notifications sent</p>
              </div>
            </div>

            <div className="max-h-[600px] overflow-y-auto">
              {loadingHistory ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="py-12 text-center px-5">
                  <Megaphone className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">No broadcasts sent yet</p>
                  <p className="text-xs text-gray-300 mt-1">Your sent notifications will appear here</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {history.map((b) => {
                    const badge = TYPE_BADGE[b.type] || TYPE_BADGE.announcement;
                    return (
                      <div key={b.id} className="px-4 py-3.5 hover:bg-gray-50/50 transition-colors">
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <p className="text-sm font-semibold text-gray-900 line-clamp-1">{b.title}</p>
                          <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
                            {timeAgo(b.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2 mb-2">{b.message}</p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                            {b.type.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <Users className="w-3 h-3" />
                            {AUDIENCE_LABEL[b.target_audience] || b.target_audience}
                          </span>
                          <span className="text-[10px] text-gray-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {b.recipients_count} sent
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
