import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Megaphone, Gift, Info, AlertTriangle } from 'lucide-react';

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  data: Record<string, unknown> | null;
  created_at: string | null;
}

interface Props {
  userId: string;
}

const ICON_MAP: Record<string, typeof Megaphone> = {
  promo: Gift,
  info: Info,
  warning: AlertTriangle,
  announcement: Megaphone,
};

const STYLE_MAP: Record<string, { bg: string; border: string; iconBg: string; iconColor: string }> = {
  promo: {
    bg: 'bg-gradient-to-r from-emerald-50 to-teal-50',
    border: 'border-emerald-200',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
  },
  info: {
    bg: 'bg-gradient-to-r from-moveme-blue-50 to-sky-50',
    border: 'border-moveme-blue-200',
    iconBg: 'bg-moveme-blue-100',
    iconColor: 'text-moveme-blue-600',
  },
  warning: {
    bg: 'bg-gradient-to-r from-amber-50 to-yellow-50',
    border: 'border-amber-200',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
  },
  announcement: {
    bg: 'bg-gradient-to-r from-moveme-blue-50 to-sky-50',
    border: 'border-moveme-blue-200',
    iconBg: 'bg-moveme-blue-100',
    iconColor: 'text-moveme-blue-600',
  },
};

export function AnnouncementsBanner({ userId }: Props) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('dismissed_announcements');
    if (stored) {
      try {
        setDismissed(new Set(JSON.parse(stored)));
      } catch {
        // ignore parse errors
      }
    }
    fetchAnnouncements();
  }, [userId]);

  const fetchAnnouncements = async () => {
    try {
      const { data } = await supabase
        .from('notifications')
        .select('id, title, message, type, data, created_at')
        .eq('user_id', userId)
        .in('type', ['announcement', 'promo', 'platform_update', 'system_announcement'])
        .eq('read', false)
        .order('created_at', { ascending: false })
        .limit(3);

      setAnnouncements((data || []) as Announcement[]);
    } catch (error) {
      console.error('Error fetching announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (id: string) => {
    const newDismissed = new Set(dismissed);
    newDismissed.add(id);
    setDismissed(newDismissed);
    localStorage.setItem('dismissed_announcements', JSON.stringify([...newDismissed]));

    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id);
  };

  const visible = announcements.filter(a => !dismissed.has(a.id));

  if (loading || visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-5">
      {visible.map((announcement) => {
        const typeKey = announcement.type === 'platform_update' || announcement.type === 'system_announcement'
          ? 'info'
          : (STYLE_MAP[announcement.type] ? announcement.type : 'announcement');
        const style = STYLE_MAP[typeKey];
        const Icon = ICON_MAP[typeKey] || Megaphone;

        return (
          <div
            key={announcement.id}
            className={`rounded-2xl border ${style.border} ${style.bg} p-3.5 relative animate-fade-in-up`}
          >
            <button
              onClick={() => handleDismiss(announcement.id)}
              className="absolute top-2.5 right-2.5 p-1 rounded-lg hover:bg-white/60 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-gray-400" />
            </button>
            <div className="flex items-start gap-3 pr-6">
              <div className={`w-9 h-9 ${style.iconBg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                <Icon className={`w-4.5 h-4.5 ${style.iconColor}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{announcement.title}</p>
                <p className="text-xs text-gray-600 mt-0.5 leading-relaxed">{announcement.message}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
