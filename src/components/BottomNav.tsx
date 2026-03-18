import { Home, MessageSquare, Briefcase, User, Package, Bell, Plus } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface NavTab {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
  isCreateButton?: boolean;
}

interface BottomNavProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function BottomNav({ currentPath, onNavigate }: BottomNavProps) {
  const { profile, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    loadUnreadMessagesCount();

    const channel = supabase
      .channel('notifications-count-mobile')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user?.id}`,
      }, () => {
        loadUnreadCount();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages',
      }, () => {
        loadUnreadMessagesCount();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${user?.id}`,
      }, () => {
        loadUnreadMessagesCount();
      })
      .subscribe();

    const interval = setInterval(() => {
      loadUnreadCount();
      loadUnreadMessagesCount();
    }, 15000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        loadUnreadCount();
        loadUnreadMessagesCount();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  useEffect(() => {
    loadUnreadCount();
    loadUnreadMessagesCount();
  }, [currentPath]);

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
      console.error('Error loading unread count:', error);
    }
  };

  const loadUnreadMessagesCount = async () => {
    if (!user) return;

    try {
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (!participantData || participantData.length === 0) {
        setUnreadMessagesCount(0);
        return;
      }

      let totalUnread = 0;
      for (const participant of participantData) {
        const lastReadAt = participant.last_read_at || '1970-01-01T00:00:00Z';
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', participant.conversation_id)
          .neq('sender_id', user.id)
          .gt('created_at', lastReadAt);
        totalUnread += (count || 0);
      }

      setUnreadMessagesCount(totalUnread);
    } catch (error) {
      console.error('Error loading unread messages count:', error);
    }
  };

  const getTabsForRole = (): NavTab[] => {
    switch (profile?.role) {
      case 'customer':
        return [
          { id: 'home', label: 'Home', icon: Home, path: '/customer' },
          { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/customer/jobs' },
          { id: 'create', label: '', icon: Plus, path: '/create-job', isCreateButton: true },
          { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/customer/messages' },
          { id: 'profile', label: 'Profile', icon: User, path: '/customer/profile' },
        ];
      case 'courier': {
        const isCD = !!(profile as any)?.is_company_driver;
        return [
          { id: 'home', label: 'Home', icon: Home, path: '/courier' },
          { id: 'notifications', label: 'Alerts', icon: Bell, path: '/courier/notifications' },
          { id: 'jobs', label: isCD ? 'Assign' : 'Jobs', icon: Package, path: '/courier/jobs' },
          { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/courier/messages' },
          { id: 'profile', label: 'Profile', icon: User, path: '/courier/profile' },
        ];
      }
      case 'business':
        if (profile?.business_type === 'haulage') {
          return [
            { id: 'home', label: 'Home', icon: Home, path: '/courier' },
            { id: 'notifications', label: 'Alerts', icon: Bell, path: '/courier/notifications' },
            { id: 'jobs', label: 'Jobs', icon: Package, path: '/courier/jobs' },
            { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/courier/messages' },
            { id: 'profile', label: 'Profile', icon: User, path: '/courier/profile' },
          ];
        } else {
          return [
            { id: 'dashboard', label: 'Home', icon: Home, path: '/business' },
            { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/business/jobs' },
            { id: 'create', label: '', icon: Plus, path: '/create-job', isCreateButton: true },
            { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/business/messages' },
            { id: 'profile', label: 'Profile', icon: User, path: '/business/profile' },
          ];
        }
      default:
        return [];
    }
  };

  const tabs = getTabsForRole();

  if (tabs.length === 0) {
    return null;
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-gray-100 shadow-nav z-50 md:hidden safe-bottom no-tap-highlight">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentPath === tab.path;

          if (tab.isCreateButton) {
            return (
              <button
                key={tab.id}
                data-tour={`nav-${tab.id}`}
                onClick={() => onNavigate(tab.path)}
                className="flex items-center justify-center flex-1 h-full relative"
              >
                <div className="w-13 h-13 -mt-6 rounded-full bg-moveme-blue-600 flex items-center justify-center shadow-lg shadow-moveme-blue-600/30 active:scale-95 transition-transform duration-150 ring-4 ring-white">
                  <Plus className="w-6 h-6 text-white stroke-[2.5]" />
                </div>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              data-tour={`nav-${tab.id}`}
              onClick={() => onNavigate(tab.path)}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 relative group ${
                isActive
                  ? 'text-moveme-blue-600'
                  : 'text-gray-400 active:text-gray-600'
              }`}
            >
              <div className="relative">
                {isActive && (
                  <div className="absolute -inset-2.5 bg-moveme-blue-50 rounded-xl -z-10 animate-scale-in" />
                )}
                <Icon className={`w-5.5 h-5.5 mb-0.5 transition-all duration-200 ${
                  isActive ? 'stroke-[2.5]' : 'stroke-[1.75]'
                }`} />
                {tab.id === 'notifications' && unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-error-500 text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 ring-2 ring-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
                {tab.id === 'messages' && unreadMessagesCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-error-500 text-white text-[9px] font-bold min-w-[16px] h-4 rounded-full flex items-center justify-center px-1 ring-2 ring-white">
                    {unreadMessagesCount > 9 ? '9+' : unreadMessagesCount}
                  </span>
                )}
              </div>
              <span className={`text-[10px] leading-tight transition-all duration-200 ${
                isActive ? 'font-bold' : 'font-medium'
              }`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
