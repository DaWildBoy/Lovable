import { Bell } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface HeaderNotificationBellProps {
  onNavigate: (path: string) => void;
  notificationsPath: string;
}

export function HeaderNotificationBell({ onNavigate, notificationsPath }: HeaderNotificationBellProps) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    loadUnreadCount();

    const channel = supabase
      .channel('header-notifications-count')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, () => {
        loadUnreadCount();
      })
      .subscribe();

    const interval = setInterval(loadUnreadCount, 15000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadUnreadCount();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  const loadUnreadCount = async () => {
    if (!user) return;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false);
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error loading notification count:', error);
    }
  };

  return (
    <button
      onClick={() => onNavigate(notificationsPath)}
      className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white/15 hover:bg-white/25 active:scale-95 transition-all duration-150"
    >
      <Bell className="w-5 h-5 text-white stroke-[1.75]" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 bg-error-500 text-white text-[9px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1 ring-2 ring-moveme-blue-600">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
