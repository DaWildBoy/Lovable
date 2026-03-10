import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageSquare, Search, ArrowLeft, User, Briefcase, Clock, ChevronRight, Send, Loader2 } from 'lucide-react';

interface Conversation {
  id: string;
  type: string;
  job_id: string | null;
  status: string;
  last_message_at: string | null;
  created_at: string | null;
  participantNames: string[];
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_type: string;
  content: string;
  created_at: string | null;
}

const TYPE_FILTERS = ['All', 'Job', 'Support'] as const;

function formatTime(ts: string | null) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 86400000 && d.getDate() === now.getDate()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function typeBadge(type: string) {
  if (type === 'job') return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-moveme-blue-50 text-moveme-blue-700"><Briefcase className="w-3 h-3" />Job</span>;
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-moveme-teal-50 text-moveme-teal-700"><User className="w-3 h-3" />Support</span>;
}

export function AdminMessages() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<typeof TYPE_FILTERS[number]>('All');
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchConversations(); }, []);

  useEffect(() => {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selected) return;
    const channel = supabase
      .channel(`admin-msgs-${selected}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selected}` }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages((prev) => [...prev, newMsg]);
        markConversationAsRead(selected);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selected]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const { data: convos, error } = await supabase
        .from('conversations')
        .select('id, type, job_id, status, last_message_at, created_at')
        .order('last_message_at', { ascending: false });
      if (error) throw error;
      const rows = convos || [];

      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id');
      const partMap: Record<string, string[]> = {};
      (participants || []).forEach((p: any) => {
        if (!partMap[p.conversation_id]) partMap[p.conversation_id] = [];
        partMap[p.conversation_id].push(p.user_id);
      });

      const allUserIds = [...new Set((participants || []).map((p: any) => p.user_id))];
      const nameMap: Record<string, string> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, first_name')
          .in('id', allUserIds);
        (profiles || []).forEach((p: any) => {
          nameMap[p.id] = p.full_name || p.first_name || 'Unknown';
        });
      }
      setNames(nameMap);

      setConversations(rows.map((c: any) => ({
        ...c,
        participantNames: (partMap[c.id] || []).map((uid: string) => nameMap[uid] || 'Unknown'),
      })));
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally { setLoading(false); }
  };

  const markConversationAsRead = async (conversationId: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    const { data: existing } = await supabase
      .from('conversation_participants')
      .select('id')
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('conversation_participants')
        .update({ last_read_at: now })
        .eq('conversation_id', conversationId)
        .eq('user_id', user.id);
    }
  };

  const selectConversation = async (id: string) => {
    setSelected(id);
    setMsgLoading(true);
    setReplyText('');
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, conversation_id, sender_id, sender_type, content, created_at')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);

      await markConversationAsRead(id);

      const senderIds = [...new Set((data || []).map((m: any) => m.sender_id).filter(Boolean))] as string[];
      const missing = senderIds.filter((sid) => !names[sid]);
      if (missing.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, first_name')
          .in('id', missing);
        const updated = { ...names };
        (profiles || []).forEach((p: any) => {
          updated[p.id] = p.full_name || p.first_name || 'Unknown';
        });
        setNames(updated);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally { setMsgLoading(false); }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selected || !user) return;
    setSending(true);
    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: selected,
        sender_id: user.id,
        sender_type: 'user',
        content: replyText.trim(),
      });
      if (error) throw error;
      setReplyText('');
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', selected);
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally { setSending(false); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const filtered = conversations.filter((c) => {
    if (typeFilter !== 'All' && c.type !== typeFilter.toLowerCase()) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return c.participantNames.some((n) => n.toLowerCase().includes(q));
  });

  const selectedConvo = conversations.find((c) => c.id === selected);

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
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">{conversations.length}</span>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by participant name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder:text-gray-400 focus:border-moveme-blue-500 focus:ring-1 focus:ring-moveme-blue-500/20 outline-none transition-all"
          />
        </div>
        <div className="flex gap-1.5">
          {TYPE_FILTERS.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${typeFilter === t ? 'bg-moveme-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >{t}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <MessageSquare className="w-10 h-10 text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No conversations found</p>
          </div>
        )}
        {filtered.map((c) => (
          <button
            key={c.id}
            onClick={() => selectConversation(c.id)}
            className={`w-full text-left px-4 py-3.5 border-b border-gray-50 hover:bg-gray-50 transition-colors flex items-center gap-3 ${selected === c.id ? 'bg-moveme-blue-50/50' : ''}`}
          >
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-gray-500" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900 truncate">{c.participantNames.join(', ') || 'No participants'}</p>
                <span className="text-xs text-gray-400 flex-shrink-0">{formatTime(c.last_message_at)}</span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                {typeBadge(c.type)}
                {c.job_id && <span className="text-xs text-gray-400 truncate">Job: {c.job_id.slice(0, 8)}</span>}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );

  const messagePanel = (
    <div className={`flex flex-col h-full ${selected ? 'flex' : 'hidden md:flex'}`}>
      {!selected ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <MessageSquare className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-sm">Select a conversation to view messages</p>
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
            <button onClick={() => { setSelected(null); setMessages([]); }} className="md:hidden p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{selectedConvo?.participantNames.join(', ')}</p>
              <div className="flex items-center gap-2 mt-0.5">
                {selectedConvo && typeBadge(selectedConvo.type)}
                {selectedConvo?.job_id && <span className="text-xs text-gray-400">Job: {selectedConvo.job_id.slice(0, 8)}</span>}
                <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3 h-3" />{formatTime(selectedConvo?.created_at ?? null)}</span>
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {msgLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-moveme-blue-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <p className="text-sm">No messages in this conversation</p>
              </div>
            ) : (
              messages.map((m) => {
                const isCurrentUser = m.sender_id === user?.id;
                const isUser = m.sender_type === 'user';
                const senderName = m.sender_id ? (names[m.sender_id] || 'Unknown') : (m.sender_type === 'bot' ? 'System Bot' : 'Admin');
                return (
                  <div key={m.id} className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] ${isCurrentUser ? 'bg-moveme-blue-600 text-white' : isUser ? 'bg-moveme-blue-50' : 'bg-gray-100'} rounded-2xl px-4 py-2.5`}>
                      <p className={`text-xs font-medium mb-1 ${isCurrentUser ? 'text-moveme-blue-100' : isUser ? 'text-moveme-blue-700' : 'text-gray-500'}`}>
                        {isCurrentUser ? 'You (Admin)' : senderName}
                      </p>
                      <p className={`text-sm whitespace-pre-wrap ${isCurrentUser ? 'text-white' : 'text-gray-900'}`}>{m.content}</p>
                      <p className={`text-xs mt-1.5 ${isCurrentUser ? 'text-moveme-blue-200' : isUser ? 'text-moveme-blue-400' : 'text-gray-400'}`}>
                        {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>
          <div className="px-4 py-3 border-t border-gray-100 bg-white">
            <div className="flex items-end gap-2">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a reply..."
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
        </>
      )}
    </div>
  );

  return (
    <div className="animate-fade-in h-[calc(100vh-8rem)]">
      <div className="bg-white rounded-2xl border border-gray-100 h-full flex overflow-hidden">
        <div className="w-full md:w-1/3 border-r border-gray-100 flex flex-col">{listPanel}</div>
        <div className="w-full md:w-2/3 flex flex-col">{messagePanel}</div>
      </div>
    </div>
  );
}
