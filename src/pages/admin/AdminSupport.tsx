import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  HeadphonesIcon,
  Search,
  ArrowLeft,
  Send,
  Loader2,
  Bot,
  User,
  UserCheck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  XCircle,
} from 'lucide-react';

interface SupportSession {
  id: string;
  user_id: string;
  user_role: string;
  active_job_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  userName: string;
  userEmail: string;
  messageCount: number;
  lastMessageAt: string | null;
}

interface SupportMsg {
  id: string;
  session_id: string;
  sender_type: string;
  sender_id: string | null;
  content: string;
  created_at: string;
}

const STATUS_FILTERS = ['All', 'Needs Attention', 'Active', 'Resolved'] as const;

function formatTime(ts: string | null) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function timeAgo(ts: string | null) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function statusBadge(status: string) {
  switch (status) {
    case 'human_requested':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 animate-pulse">
          <AlertTriangle className="w-3 h-3" />
          Needs Agent
        </span>
      );
    case 'human_active':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
          <UserCheck className="w-3 h-3" />
          Agent Active
        </span>
      );
    case 'ai_active':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
          <Bot className="w-3 h-3" />
          AI Active
        </span>
      );
    case 'resolved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
          <CheckCircle2 className="w-3 h-3" />
          Resolved
        </span>
      );
    default:
      return null;
  }
}

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    customer: 'bg-moveme-blue-50 text-moveme-blue-700',
    courier: 'bg-moveme-teal-50 text-moveme-teal-700',
    retailer: 'bg-orange-50 text-orange-700',
    haulage: 'bg-gray-100 text-gray-700',
  };
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${colors[role] || 'bg-gray-100 text-gray-600'}`}>
      {role}
    </span>
  );
}

export function AdminSupport() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [messages, setMessages] = useState<SupportMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('All');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 8000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (selected) {
      pollingRef.current = setInterval(async () => {
        const { data } = await supabase
          .from('support_messages')
          .select('id, session_id, sender_type, sender_id, content, created_at')
          .eq('session_id', selected)
          .order('created_at', { ascending: true });
        if (data && data.length > messages.length) {
          setMessages(data);
        }
      }, 3000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [selected, messages.length]);

  const fetchSessions = async () => {
    try {
      const { data: sessRows, error } = await supabase
        .from('support_sessions')
        .select('id, user_id, user_role, active_job_id, status, created_at, updated_at')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      const rows = sessRows || [];

      const userIds = [...new Set(rows.map((s: any) => s.user_id))];
      const nameMap: Record<string, { name: string; email: string }> = {};

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, first_name, email')
          .in('id', userIds);
        (profiles || []).forEach((p: any) => {
          nameMap[p.id] = {
            name: p.full_name || p.first_name || 'Unknown',
            email: p.email || '',
          };
        });
      }

      const { data: msgCounts } = await supabase
        .from('support_messages')
        .select('session_id, created_at')
        .in('session_id', rows.map((s: any) => s.id))
        .order('created_at', { ascending: false });

      const countMap: Record<string, { count: number; lastAt: string | null }> = {};
      (msgCounts || []).forEach((m: any) => {
        if (!countMap[m.session_id]) {
          countMap[m.session_id] = { count: 0, lastAt: m.created_at };
        }
        countMap[m.session_id].count++;
      });

      const enriched: SupportSession[] = rows.map((s: any) => ({
        ...s,
        userName: nameMap[s.user_id]?.name || 'Unknown',
        userEmail: nameMap[s.user_id]?.email || '',
        messageCount: countMap[s.id]?.count || 0,
        lastMessageAt: countMap[s.id]?.lastAt || s.created_at,
      }));

      enriched.sort((a, b) => {
        const priority: Record<string, number> = { human_requested: 0, human_active: 1, ai_active: 2, resolved: 3 };
        const pA = priority[a.status] ?? 4;
        const pB = priority[b.status] ?? 4;
        if (pA !== pB) return pA - pB;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      setSessions(enriched);
    } catch (err) {
      console.error('Failed to fetch support sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectSession = async (id: string) => {
    setSelected(id);
    setMsgLoading(true);
    setReplyText('');
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('id, session_id, sender_type, sender_id, content, created_at')
        .eq('session_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setMsgLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selected || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        session_id: selected,
        sender_type: 'admin',
        sender_id: user.id,
        content: replyText.trim(),
      });
      if (error) throw error;

      setMessages(prev => [...prev, {
        id: `admin-${Date.now()}`,
        session_id: selected,
        sender_type: 'admin',
        sender_id: user.id,
        content: replyText.trim(),
        created_at: new Date().toISOString(),
      }]);
      setReplyText('');

      const session = sessions.find(s => s.id === selected);
      if (session && session.status === 'human_requested') {
        await supabase
          .from('support_sessions')
          .update({ status: 'human_active', updated_at: new Date().toISOString() })
          .eq('id', selected);

        setSessions(prev => prev.map(s =>
          s.id === selected ? { ...s, status: 'human_active' } : s
        ));
      }
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!selected) return;
    try {
      await supabase
        .from('support_sessions')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', selected);

      setSessions(prev => prev.map(s =>
        s.id === selected ? { ...s, status: 'resolved' } : s
      ));
    } catch (err) {
      console.error('Failed to resolve session:', err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const filtered = sessions.filter((s) => {
    if (statusFilter === 'Needs Attention' && s.status !== 'human_requested') return false;
    if (statusFilter === 'Active' && !['ai_active', 'human_active'].includes(s.status)) return false;
    if (statusFilter === 'Resolved' && s.status !== 'resolved') return false;
    if (search) {
      const q = search.toLowerCase();
      return s.userName.toLowerCase().includes(q) || s.userEmail.toLowerCase().includes(q);
    }
    return true;
  });

  const needsAttentionCount = sessions.filter(s => s.status === 'human_requested').length;
  const selectedSession = sessions.find(s => s.id === selected);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 animate-fade-in">
        <div className="w-7 h-7 border-2 border-moveme-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const listPanel = (
    <div className={`flex flex-col h-full ${selected ? 'hidden md:flex' : 'flex'}`}>
      <div className="p-4 border-b border-gray-100 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">Support Queue</h1>
            {needsAttentionCount > 0 && (
              <span className="min-w-[20px] h-5 px-1.5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
                {needsAttentionCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <HeadphonesIcon className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">{sessions.length}</span>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setStatusFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === t
                  ? t === 'Needs Attention'
                    ? 'bg-red-600 text-white'
                    : 'bg-moveme-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t}
              {t === 'Needs Attention' && needsAttentionCount > 0 && (
                <span className="ml-1.5 text-[10px] bg-white/30 px-1 rounded">{needsAttentionCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <HeadphonesIcon className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No support sessions found</p>
          </div>
        )}
        {filtered.map((s) => (
          <button
            key={s.id}
            onClick={() => selectSession(s.id)}
            className={`w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors ${
              selected === s.id ? 'bg-moveme-blue-50/50' : ''
            } ${s.status === 'human_requested' ? 'border-l-4 border-l-red-500' : ''}`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                s.status === 'human_requested' ? 'bg-red-100' : 'bg-gray-100'
              }`}>
                <User className={`w-4 h-4 ${s.status === 'human_requested' ? 'text-red-600' : 'text-gray-500'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.userName}</p>
                  <span className="text-xs text-gray-400 flex-shrink-0">{timeAgo(s.lastMessageAt)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {statusBadge(s.status)}
                  {roleBadge(s.user_role)}
                  <span className="text-xs text-gray-400">{s.messageCount} msgs</span>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );

  const messagePanel = (
    <div className={`flex flex-col h-full ${selected ? 'flex' : 'hidden md:flex'}`}>
      {!selected ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <HeadphonesIcon className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-sm">Select a session to view the conversation</p>
          {needsAttentionCount > 0 && (
            <p className="text-xs text-red-500 mt-2 font-medium">{needsAttentionCount} session(s) need attention</p>
          )}
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <button onClick={() => { setSelected(null); setMessages([]); }} className="md:hidden p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{selectedSession?.userName}</p>
                {selectedSession && roleBadge(selectedSession.user_role)}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {selectedSession && statusBadge(selectedSession.status)}
                {selectedSession?.active_job_id && (
                  <span className="text-xs text-gray-400">Job: {selectedSession.active_job_id.slice(0, 8)}</span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />{formatTime(selectedSession?.created_at ?? null)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {selectedSession?.status !== 'resolved' && (
                <button
                  onClick={handleResolve}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-emerald-700 hover:bg-emerald-50 border border-gray-200 rounded-lg transition-colors"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Resolve
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {msgLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-moveme-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <p className="text-sm">No messages yet</p>
              </div>
            ) : (
              messages.map((m) => {
                const isAdmin = m.sender_type === 'admin';
                const isUser = m.sender_type === 'user';
                const isAI = m.sender_type === 'ai';
                const isCurrentAdmin = m.sender_id === user?.id;

                return (
                  <div key={m.id} className={`flex ${isCurrentAdmin ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isCurrentAdmin
                        ? 'bg-moveme-blue-600 text-white'
                        : isAdmin
                          ? 'bg-amber-50 border border-amber-200'
                          : isUser
                            ? 'bg-gray-100'
                            : 'bg-blue-50 border border-blue-100'
                    }`}>
                      <div className="flex items-center gap-1.5 mb-1">
                        {isAI && <Sparkles className="w-3 h-3 text-blue-500" />}
                        {isUser && <User className="w-3 h-3 text-gray-500" />}
                        {isAdmin && !isCurrentAdmin && <UserCheck className="w-3 h-3 text-amber-600" />}
                        <p className={`text-xs font-medium ${
                          isCurrentAdmin ? 'text-blue-100' : isAI ? 'text-blue-600' : isUser ? 'text-gray-500' : 'text-amber-600'
                        }`}>
                          {isCurrentAdmin ? 'You (Admin)' : isAdmin ? 'Admin' : isAI ? 'AI Bot' : selectedSession?.userName || 'User'}
                        </p>
                      </div>
                      <p className={`text-sm whitespace-pre-wrap ${isCurrentAdmin ? 'text-white' : 'text-gray-900'}`}>
                        {m.content}
                      </p>
                      <p className={`text-xs mt-1.5 ${
                        isCurrentAdmin ? 'text-blue-200' : 'text-gray-400'
                      }`}>
                        {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {selectedSession?.status !== 'resolved' && (
            <div className="px-4 py-3 border-t border-gray-100 bg-white">
              <div className="flex items-end gap-2">
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a reply as admin..."
                  rows={1}
                  className="flex-1 resize-none px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all max-h-24"
                />
                <button
                  onClick={handleSendReply}
                  disabled={!replyText.trim() || sending}
                  className="p-2.5 bg-moveme-blue-600 text-white rounded-xl hover:bg-moveme-blue-700 transition-colors disabled:opacity-40 disabled:hover:bg-moveme-blue-600 flex-shrink-0"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in h-[calc(100vh-8rem)]">
      <div className="bg-white rounded-2xl border border-gray-100 h-full flex overflow-hidden">
        <div className="w-full md:w-[380px] border-r border-gray-100 flex flex-col">{listPanel}</div>
        <div className="w-full md:flex-1 flex flex-col">{messagePanel}</div>
      </div>
    </div>
  );
}
