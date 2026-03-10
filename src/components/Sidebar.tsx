import { Home, MessageSquare, Briefcase, User, Package, LogOut, Bell } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  path: string;
}

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export function Sidebar({ currentPath, onNavigate }: SidebarProps) {
  const { profile, signOut, user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);

  useEffect(() => {
    loadUnreadCount();
    loadUnreadMessagesCount();

    const channel = supabase
      .channel('notifications-count')
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

      const conversationIds = participantData.map(p => p.conversation_id);

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

  const getNavItemsForRole = (): NavItem[] => {
    switch (profile?.role) {
      case 'customer':
        return [
          { id: 'home', label: 'Home', icon: Home, path: '/customer' },
          { id: 'notifications', label: 'Notifications', icon: Bell, path: '/customer/notifications' },
          { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/customer/messages' },
          { id: 'jobs', label: 'My Jobs', icon: Briefcase, path: '/customer/jobs' },
          { id: 'profile', label: 'Profile', icon: User, path: '/customer/profile' },
        ];
      case 'courier': {
        const isCD = !!(profile as any)?.is_company_driver;
        return [
          { id: 'home', label: 'Home', icon: Home, path: '/courier' },
          { id: 'notifications', label: 'Notifications', icon: Bell, path: '/courier/notifications' },
          { id: 'jobs', label: isCD ? 'Assignments' : 'Jobs', icon: Package, path: '/courier/jobs' },
          { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/courier/messages' },
          { id: 'profile', label: 'Profile', icon: User, path: '/courier/profile' },
        ];
      }
      case 'business':
        if (profile?.business_type === 'haulage') {
          return [
            { id: 'home', label: 'Home', icon: Home, path: '/courier' },
            { id: 'notifications', label: 'Notifications', icon: Bell, path: '/courier/notifications' },
            { id: 'jobs', label: 'Jobs', icon: Package, path: '/courier/jobs' },
            { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/courier/messages' },
            { id: 'profile', label: 'Profile', icon: User, path: '/courier/profile' },
          ];
        } else {
          return [
            { id: 'dashboard', label: 'Dashboard', icon: Home, path: '/business' },
            { id: 'notifications', label: 'Notifications', icon: Bell, path: '/business/notifications' },
            { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/business/jobs' },
            { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/business/messages' },
            { id: 'profile', label: 'Profile', icon: User, path: '/business/profile' },
          ];
        }
      default:
        return [];
    }
  };

  const navItems = getNavItemsForRole();

  if (navItems.length === 0) {
    return null;
  }

  const getRoleLabel = () => {
    switch (profile?.role) {
      case 'business':
        return profile?.business_type === 'haulage' ? 'Haulage Company' : 'Business Account';
      case 'courier':
        return (profile as any)?.is_company_driver ? 'Company Driver' : 'Courier Account';
      default:
        return 'Customer Account';
    }
  };

  return (
    <aside className="hidden md:flex md:flex-col md:fixed md:inset-y-0 md:left-0 md:w-64 bg-white border-r border-gray-100 z-50">
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-100">
          <div className="flex items-center justify-center w-10 h-10 flex-shrink-0">
            <img src="/untitled_design_(4)_(1).svg" alt="MoveMe TT" className="w-10 h-10" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 tracking-tight truncate">MoveMe TT</h1>
            <p className="text-xs text-gray-400 truncate">{getRoleLabel()}</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.path;

              return (
                <button
                  key={item.id}
                  data-tour={`nav-${item.id}`}
                  onClick={() => onNavigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 relative ${
                    isActive
                      ? 'bg-moveme-blue-50 text-moveme-blue-700 font-semibold shadow-sm'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                  }`}
                >
                  <Icon className={`w-[18px] h-[18px] transition-colors duration-200 ${
                    isActive ? 'text-moveme-blue-600' : 'text-gray-400'
                  }`} />
                  <span className="text-sm">{item.label}</span>
                  {item.id === 'notifications' && unreadCount > 0 && (
                    <span className="ml-auto bg-error-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                  {item.id === 'messages' && unreadMessagesCount > 0 && (
                    <span className="ml-auto bg-error-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-gray-100">
          <div className="bg-gray-50 rounded-xl p-3 mb-2.5">
            <p className="text-xs text-gray-400 mb-0.5">Signed in as</p>
            <p className="text-sm font-semibold text-gray-900 truncate">{profile?.first_name || 'User'}</p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{profile?.email}</p>
          </div>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-gray-500 hover:text-error-600 hover:bg-error-50 transition-all duration-200 font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
