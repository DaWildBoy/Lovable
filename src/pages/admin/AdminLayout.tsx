import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Building2,
  Settings,
  Search,
  Bell,
  LogOut,
  Menu,
  X,
  ChevronDown,
  MessageSquare,
  DollarSign,
  Shield,
  UserCircle,
  FileText,
  Palette,
  Megaphone,
  ClipboardList,
  Loader2,
  User,
  Hash,
  Headphones,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  isSuperAdmin,
  getAdminRoleLabel,
  canAccessJobs,
  canAccessCompanies,
  canAccessMessages,
  canAccessRevenue,
  canAccessSettings,
  canAccessInvoices,
  canAccessCompanySettings,
} from '../../lib/adminAuth';
import { timeAgo } from './adminUtils';

interface AdminLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

type NavItem = {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  path: string;
  check?: (profile: { role?: string } | null) => boolean;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Dashboard', icon: LayoutDashboard, path: '/admin' },
  { id: 'jobs', label: 'Jobs', icon: Briefcase, path: '/admin/jobs', check: canAccessJobs },
  { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
  { id: 'companies', label: 'Companies', icon: Building2, path: '/admin/companies', check: canAccessCompanies },
  { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/admin/messages', check: canAccessMessages },
  { id: 'support', label: 'Support', icon: Headphones, path: '/admin/support', check: canAccessMessages },
  { id: 'invoices', label: 'Invoices', icon: FileText, path: '/admin/invoices', check: canAccessInvoices },
  { id: 'revenue', label: 'Revenue', icon: DollarSign, path: '/admin/revenue', check: canAccessRevenue },
  { id: 'broadcast', label: 'Push Notifications', icon: Megaphone, path: '/admin/broadcast', check: canAccessJobs },
  { id: 'audit', label: 'Audit Log', icon: ClipboardList, path: '/admin/audit', check: canAccessSettings },
  { id: 'branding', label: 'Branding', icon: Palette, path: '/admin/branding', check: canAccessCompanySettings },
  { id: 'settings', label: 'Settings', icon: Settings, path: '/admin/settings', check: canAccessSettings },
];

interface SearchResult {
  type: 'user' | 'job' | 'company';
  id: string;
  label: string;
  sublabel: string;
  path: string;
}

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string | null;
  read: boolean | null;
}

export function AdminLayout({ currentPath, onNavigate, children }: AdminLayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const isActive = (path: string) => {
    if (path === '/admin') return currentPath === '/admin';
    return currentPath.startsWith(path);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, created_at, read')
      .eq('user_id', currentUser.id)
      .order('created_at', { ascending: false })
      .limit(15);
    const items = (data || []) as NotificationItem[];
    setNotifications(items);
    setUnreadCount(items.filter((n) => !n.read).length);
  };

  const markAllNotificationsRead = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) return;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .in('id', unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    setSearchOpen(true);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      const results: SearchResult[] = [];
      const term = q.toLowerCase();

      const [profileRes, jobRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, first_name, email, role, company_name')
          .or(`full_name.ilike.%${term}%,first_name.ilike.%${term}%,email.ilike.%${term}%,company_name.ilike.%${term}%`)
          .limit(5),
        supabase
          .from('jobs')
          .select('id, job_reference_id, pickup_location_text, status')
          .or(`job_reference_id.ilike.%${term}%,pickup_location_text.ilike.%${term}%,dropoff_location_text.ilike.%${term}%`)
          .limit(5),
      ]);

      (profileRes.data || []).forEach((p: any) => {
        const isCompany = p.role === 'business';
        results.push({
          type: isCompany ? 'company' : 'user',
          id: p.id,
          label: p.company_name || p.full_name || p.first_name || 'Unnamed',
          sublabel: `${p.email || ''} -- ${p.role || ''}`,
          path: isCompany ? '/admin/companies' : '/admin/users',
        });
      });

      (jobRes.data || []).forEach((j: any) => {
        results.push({
          type: 'job',
          id: j.id,
          label: j.job_reference_id || j.id.slice(0, 8),
          sublabel: `${j.pickup_location_text || ''} -- ${j.status || ''}`,
          path: '/admin/jobs',
        });
      });

      setSearchResults(results);
      setSearchLoading(false);
    }, 300);
  };

  const TYPE_ICON = { user: User, job: Hash, company: Building2 };
  const TYPE_COLOR = {
    user: 'bg-moveme-blue-50 text-moveme-blue-600',
    job: 'bg-warning-50 text-warning-600',
    company: 'bg-moveme-teal-50 text-moveme-teal-600',
  };

  return (
    <div className="min-h-screen bg-gray-50/80">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[260px] bg-white border-r border-gray-200/80 flex flex-col transition-transform duration-300 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-3 px-5 h-16 border-b border-gray-100 flex-shrink-0">
          <div className="w-9 h-9 flex-shrink-0">
            <img src="/untitled_design_(4)_(1).svg" alt="MoveMe TT" className="w-9 h-9" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-bold text-gray-900 leading-tight">MoveMe TT</h1>
            <p className="text-[11px] font-medium text-moveme-blue-600 tracking-wide uppercase">Admin</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <div className="space-y-0.5">
            {NAV_ITEMS.filter((item) => !item.check || item.check(profile)).map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onNavigate(item.path);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm transition-all duration-150 ${
                    active
                      ? 'bg-moveme-blue-50 text-moveme-blue-700 font-semibold'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 font-medium'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] flex-shrink-0 ${
                      active ? 'text-moveme-blue-600' : 'text-gray-400'
                    }`}
                  />
                  {item.label}
                </button>
              );
            })}
          </div>
        </nav>

        <div className="px-3 pb-4 pt-2 border-t border-gray-100 flex-shrink-0">
          <button
            onClick={() => {
              onNavigate('/admin/profile');
              setMobileMenuOpen(false);
            }}
            className="w-full bg-gray-50 hover:bg-gray-100 rounded-xl p-3 mb-2.5 text-left transition-colors group"
          >
            <p className="text-[11px] text-gray-400 mb-0.5 uppercase tracking-wider font-medium">
              {getAdminRoleLabel(profile?.role || '')}
            </p>
            <p className="text-sm font-semibold text-gray-900 truncate group-hover:text-moveme-blue-700 transition-colors">
              {profile?.first_name || 'Admin'}
            </p>
            <p className="text-xs text-gray-400 truncate mt-0.5">{profile?.email}</p>
          </button>
          <button
            onClick={() => signOut()}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-gray-500 hover:text-error-600 hover:bg-error-50 transition-all duration-200 font-medium text-sm"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </aside>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div className="lg:pl-[260px]">
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-gray-200/60 h-16 flex items-center px-4 lg:px-6 gap-4">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex-1 max-w-md relative" ref={searchRef}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search jobs, users, companies..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                onFocus={() => searchQuery.trim() && setSearchOpen(true)}
                className="w-full pl-10 pr-4 py-2 bg-gray-100/80 border border-transparent rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-gray-200 focus:ring-1 focus:ring-moveme-blue-500/20 transition-all outline-none"
              />
            </div>
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-elevated border border-gray-200 overflow-hidden z-50">
                {searchLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 text-moveme-blue-600 animate-spin" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="py-6 text-center text-sm text-gray-400">No results found</div>
                ) : (
                  <div className="max-h-72 overflow-y-auto py-1">
                    {searchResults.map((r) => {
                      const Icon = TYPE_ICON[r.type];
                      const color = TYPE_COLOR[r.type];
                      return (
                        <button
                          key={`${r.type}-${r.id}`}
                          onClick={() => {
                            onNavigate(r.path);
                            setSearchOpen(false);
                            setSearchQuery('');
                            setSearchResults([]);
                          }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">{r.label}</p>
                            <p className="text-xs text-gray-400 truncate">{r.sublabel}</p>
                          </div>
                          <span className="text-[10px] font-medium text-gray-400 uppercase">{r.type}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative" ref={bellRef}>
              <button
                onClick={() => {
                  const opening = !bellOpen;
                  setBellOpen(opening);
                  setProfileMenuOpen(false);
                  if (opening && unreadCount > 0) markAllNotificationsRead();
                }}
                className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-error-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              {bellOpen && (
                <div className="absolute right-0 top-full mt-1 w-80 bg-white rounded-xl shadow-elevated border border-gray-200 z-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">Notifications</p>
                    {unreadCount > 0 && (
                      <span className="text-xs text-moveme-blue-600 font-medium">{unreadCount} new</span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <div className="py-8 text-center text-sm text-gray-400">No notifications</div>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n.id}
                          className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50/50 transition-colors ${
                            !n.read ? 'bg-moveme-blue-50/30' : ''
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${n.read ? 'bg-gray-300' : 'bg-moveme-blue-600'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">{n.title}</p>
                              <p className="text-xs text-gray-500 truncate">{n.message}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setProfileMenuOpen(!profileMenuOpen); setBellOpen(false); }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="w-8 h-8 rounded-full bg-moveme-blue-100 flex items-center justify-center">
                  <span className="text-sm font-semibold text-moveme-blue-700">
                    {(profile?.first_name || 'A')[0].toUpperCase()}
                  </span>
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700">
                  {profile?.first_name || 'Admin'}
                </span>
                <ChevronDown className="w-4 h-4 text-gray-400 hidden sm:block" />
              </button>

              {profileMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setProfileMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-elevated border border-gray-200 py-1.5 z-50 animate-fade-in">
                    <div className="px-3 py-2 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {profile?.first_name || 'Admin'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{profile?.email}</p>
                    </div>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        onNavigate('/admin/profile');
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-moveme-blue-600 transition-colors"
                    >
                      <UserCircle className="w-4 h-4" />
                      My Profile
                    </button>
                    <button
                      onClick={() => {
                        setProfileMenuOpen(false);
                        signOut();
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-error-600 transition-colors"
                    >
                      <LogOut className="w-4 h-4" />
                      Log out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
