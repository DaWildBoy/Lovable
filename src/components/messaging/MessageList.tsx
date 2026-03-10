import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { MessageCircle, Bot, User, Search, Mic, Image, Video, MapPin, FileText, X, Headphones, UserCheck } from 'lucide-react';
import type { Conversation } from './types';

interface MessageListProps {
  onSelectConversation: (conversationId: string, isSupport?: boolean) => void;
  selectedConversationId?: string;
}

type FilterTab = 'all' | 'jobs' | 'support';

interface SupportSessionItem {
  id: string;
  type: 'support_session';
  status: string;
  last_message_at: string;
  last_message_content: string;
  last_message_sender: string;
  unread_count: number;
}

type ListItem = (Conversation & { _kind: 'conversation' }) | (SupportSessionItem & { _kind: 'support_session' });

export function MessageList({ onSelectConversation, selectedConversationId }: MessageListProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [supportSessions, setSupportSessions] = useState<SupportSessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    loadConversations();
    loadSupportSessions();

    const channel = supabase
      .channel('msg-list-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversation_participants' }, () => loadConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_messages' }, () => loadSupportSessions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_sessions' }, () => loadSupportSessions())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const loadSupportSessions = async () => {
    if (!user) return;

    try {
      const { data: sessions } = await supabase
        .from('support_sessions')
        .select('id, status, created_at, updated_at')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (!sessions?.length) {
        setSupportSessions([]);
        return;
      }

      const items: SupportSessionItem[] = await Promise.all(
        sessions.map(async (sess) => {
          const { data: lastMsg } = await supabase
            .from('support_messages')
            .select('content, sender_type, created_at')
            .eq('session_id', sess.id)
            .order('created_at', { ascending: false })
            .limit(1);

          const msg = lastMsg?.[0];

          return {
            id: sess.id,
            type: 'support_session' as const,
            status: sess.status,
            last_message_at: msg?.created_at || sess.updated_at || sess.created_at,
            last_message_content: msg?.content || '',
            last_message_sender: msg?.sender_type || '',
            unread_count: 0,
          };
        })
      );

      setSupportSessions(items);
    } catch (err) {
      console.error('Error loading support sessions:', err);
    }
  };

  const loadConversations = async () => {
    if (!user) return;

    try {
      const { data: participantData } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', user.id);

      if (!participantData?.length) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);

      const { data: convData } = await supabase
        .from('conversations')
        .select(`*`)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false });

      if (!convData) {
        setConversations([]);
        setLoading(false);
        return;
      }

      const enriched = await Promise.all(
        convData.map(async (conv: any) => {
          const participant = participantData.find(p => p.conversation_id === conv.id);

          const { data: latestMsgData } = await supabase
            .from('messages')
            .select('content, sender_type, attachment_type, created_at')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: false })
            .limit(1);
          const lastMessage = latestMsgData && latestMsgData.length > 0 ? latestMsgData[0] : null;

          const { count: unreadCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conv.id)
            .neq('sender_id', user.id)
            .gt('created_at', participant?.last_read_at || '1970-01-01');

          let jobDetails = null;
          if (conv.job_id) {
            const { data: jobData } = await supabase
              .from('jobs')
              .select('pickup_location_text, dropoff_location_text, status')
              .eq('id', conv.job_id)
              .maybeSingle();
            jobDetails = jobData;
          }

          let otherParticipant = null;
          if (conv.type === 'job') {
            const { data: participants } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', conv.id)
              .neq('user_id', user.id);

            if (participants?.length) {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('full_name, role, avatar_url')
                .eq('id', participants[0].user_id)
                .maybeSingle();
              otherParticipant = profileData;
            }
          }

          return {
            id: conv.id,
            type: conv.type,
            job_id: conv.job_id,
            status: conv.status,
            last_message_at: conv.last_message_at,
            unread_count: unreadCount || 0,
            last_message: lastMessage ? {
              content: lastMessage.content,
              sender_type: lastMessage.sender_type,
              attachment_type: lastMessage.attachment_type,
            } : undefined,
            job: jobDetails,
            other_participant: otherParticipant,
          };
        })
      );

      setConversations(enriched);
    } catch (err) {
      console.error('Error loading conversations:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / 3600000;
    if (diffHours < 24) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (diffHours < 48) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getTitle = (conv: Conversation) => {
    if (conv.type === 'support') return 'Customer Support';
    if (conv.other_participant) return conv.other_participant.full_name;
    return 'Job Conversation';
  };

  const getSubtitle = (conv: Conversation) => {
    if (conv.type === 'support') {
      return conv.status === 'escalated' ? 'Escalated to admin' : 'AI Support';
    }
    if (conv.job) {
      const pickup = conv.job.pickup_location_text?.split(',')[0] || '';
      const dropoff = conv.job.dropoff_location_text?.split(',')[0] || '';
      return `${pickup} → ${dropoff}`;
    }
    return '';
  };

  const getLastMessagePreview = (conv: Conversation) => {
    if (!conv.last_message) return '';
    const msg = conv.last_message;
    if (msg.attachment_type === 'image') return 'Photo';
    if (msg.attachment_type === 'video') return 'Video';
    if (msg.attachment_type === 'audio') return 'Voice message';
    if (msg.attachment_type === 'location') return 'Location';
    if (msg.attachment_type === 'document') return 'Document';
    return msg.content || '';
  };

  const getAttachmentIcon = (type?: string | null) => {
    if (!type) return null;
    switch (type) {
      case 'image': return <Image className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
      case 'video': return <Video className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
      case 'audio': return <Mic className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
      case 'location': return <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
      case 'document': return <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />;
      default: return null;
    }
  };

  const isJobClosed = (conv: Conversation) => {
    return conv.job?.status === 'completed' || conv.job?.status === 'cancelled';
  };

  const getSupportStatusLabel = (status: string) => {
    switch (status) {
      case 'human_requested': return 'Waiting for agent...';
      case 'human_active': return 'Connected to agent';
      case 'resolved': return 'Resolved';
      default: return 'AI Assistant';
    }
  };

  const getSupportLastPreview = (item: SupportSessionItem) => {
    if (!item.last_message_content) return '';
    const prefix = item.last_message_sender === 'ai' ? 'AI: '
      : item.last_message_sender === 'admin' ? 'Agent: '
      : '';
    const content = item.last_message_content;
    return prefix + (content.length > 80 ? content.slice(0, 80) + '...' : content);
  };

  const allItems: ListItem[] = [
    ...conversations.map(c => ({ ...c, _kind: 'conversation' as const })),
    ...supportSessions.map(s => ({ ...s, _kind: 'support_session' as const })),
  ].sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

  const filtered = allItems.filter(item => {
    if (filter === 'jobs') {
      return item._kind === 'conversation' && item.type === 'job';
    }
    if (filter === 'support') {
      return item._kind === 'support_session' || (item._kind === 'conversation' && item.type === 'support');
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (item._kind === 'conversation') {
        const title = getTitle(item).toLowerCase();
        const subtitle = getSubtitle(item).toLowerCase();
        return title.includes(q) || subtitle.includes(q);
      }
      return 'support'.includes(q) || 'moveme support'.includes(q);
    }
    return true;
  });

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'jobs', label: 'Jobs' },
    { key: 'support', label: 'Support' },
  ];

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-gray-200" />
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-1 pb-2 space-y-3">
        {showSearch ? (
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                autoFocus
                className="w-full pl-9 pr-4 py-2 bg-gray-100 border-0 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <button
              onClick={() => { setShowSearch(false); setSearchQuery(''); }}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className={`px-3.5 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                    filter === tab.key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowSearch(true)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Search className="w-4.5 h-4.5 text-gray-400" />
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <MessageCircle className="w-8 h-8 text-gray-300" />
            </div>
            <p className="text-gray-600 font-medium text-sm">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {searchQuery
                ? 'Try a different search term'
                : 'Conversations will appear here when you start a job'}
            </p>
          </div>
        ) : (
          filtered.map((item) => {
            if (item._kind === 'support_session') {
              const isHuman = item.status === 'human_active' || item.status === 'human_requested';
              return (
                <button
                  key={`support-${item.id}`}
                  onClick={() => onSelectConversation(item.id, true)}
                  className="w-full px-4 py-3 flex items-center gap-3 transition-colors text-left hover:bg-gray-50"
                >
                  <div className="relative flex-shrink-0">
                    <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center ${
                      isHuman ? 'bg-amber-100' : 'bg-emerald-100'
                    }`}>
                      {isHuman ? (
                        <UserCheck className="w-6 h-6 text-amber-600" />
                      ) : (
                        <Headphones className="w-6 h-6 text-emerald-600" />
                      )}
                    </div>
                    {item.status !== 'resolved' && (
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                        item.status === 'human_requested' ? 'bg-amber-400' : 'bg-emerald-400'
                      }`} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h3 className="text-sm font-semibold text-gray-800 truncate">
                        MoveMe Support
                      </h3>
                      <span className="text-[11px] ml-2 flex-shrink-0 text-gray-400">
                        {formatTime(item.last_message_at)}
                      </span>
                    </div>

                    <p className="text-xs text-gray-500 mb-0.5 truncate">{getSupportStatusLabel(item.status)}</p>

                    <p className="text-xs text-gray-400 truncate">
                      {getSupportLastPreview(item)}
                    </p>
                  </div>
                </button>
              );
            }

            const conv = item;
            const hasUnread = conv.unread_count > 0;
            const closed = isJobClosed(conv);
            const selected = selectedConversationId === conv.id;

            return (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={`w-full px-4 py-3 flex items-center gap-3 transition-colors text-left hover:bg-gray-50 ${
                  selected ? 'bg-blue-50' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className={`w-12 h-12 rounded-full overflow-hidden ${
                    conv.type === 'support' ? 'bg-emerald-100' : 'bg-blue-100'
                  } flex items-center justify-center`}>
                    {conv.type === 'support' ? (
                      <Bot className="w-6 h-6 text-emerald-600" />
                    ) : conv.other_participant?.avatar_url ? (
                      <img src={conv.other_participant.avatar_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-blue-600" />
                    )}
                  </div>
                  {hasUnread && (
                    <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-blue-600 rounded-full ring-2 ring-white" />
                  )}
                  {closed && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-gray-400 rounded-full ring-2 ring-white flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">!</span>
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <h3 className={`text-sm truncate ${hasUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                      {getTitle(conv)}
                    </h3>
                    <span className={`text-[11px] ml-2 flex-shrink-0 ${hasUnread ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>

                  <p className="text-xs text-gray-500 mb-0.5 truncate">{getSubtitle(conv)}</p>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {getAttachmentIcon(conv.last_message?.attachment_type)}
                      <p className={`text-xs truncate ${hasUnread ? 'text-gray-800 font-medium' : 'text-gray-400'}`}>
                        {getLastMessagePreview(conv)}
                      </p>
                    </div>
                    {hasUnread && (
                      <span className="flex-shrink-0 ml-2 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-blue-600 text-white text-[10px] font-bold rounded-full">
                        {conv.unread_count > 9 ? '9+' : conv.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
