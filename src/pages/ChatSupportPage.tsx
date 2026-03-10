import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Send,
  Loader2,
  Bot,
  UserCheck,
  AlertCircle,
  Sparkles,
  RotateCcw,
  HandHelping,
  CheckCircle2,
} from 'lucide-react';

interface SupportMessage {
  id: string;
  sender_type: 'user' | 'ai' | 'admin';
  sender_id: string | null;
  content: string;
  created_at: string;
}

type SessionStatus = 'ai_active' | 'human_requested' | 'human_active' | 'resolved';

interface ChatSupportPageProps {
  onNavigate: (path: string) => void;
}

const QUICK_ACTIONS = [
  { label: 'How do I create a delivery?', icon: '📦' },
  { label: 'Where is my package?', icon: '📍' },
  { label: 'How does pricing work?', icon: '💰' },
  { label: 'Help with my account', icon: '🔑' },
];

export function ChatSupportPage({ onNavigate }: ChatSupportPageProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('ai_active');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [botTyping, setBotTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }, []);

  useEffect(() => {
    initSession();
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, botTyping, scrollToBottom]);

  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    if (sessionId && (sessionStatus === 'human_requested' || sessionStatus === 'human_active')) {
      pollingRef.current = setInterval(async () => {
        const { data: msgs } = await supabase
          .from('support_messages')
          .select('id, sender_type, sender_id, content, created_at')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: true });

        if (msgs && msgs.length > messages.length) {
          setMessages(msgs);
        }

        const { data: sess } = await supabase
          .from('support_sessions')
          .select('status')
          .eq('id', sessionId)
          .maybeSingle();

        if (sess && sess.status !== sessionStatus) {
          setSessionStatus(sess.status);
        }
      }, 4000);
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [sessionId, sessionStatus, messages.length]);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return {
      'Authorization': `Bearer ${session?.access_token}`,
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
    };
  };

  const callSupportBot = async (payload: Record<string, unknown>) => {
    const headers = await getAuthHeaders();
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-bot`,
      { method: 'POST', headers, body: JSON.stringify(payload) }
    );
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Request failed');
    }
    return res.json();
  };

  const initSession = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await callSupportBot({ action: 'get_or_create_session' });
      setSessionId(data.sessionId);
      setMessages(data.messages || []);
      setSessionStatus(data.status || 'ai_active');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || !sessionId || sending) return;

    const optimistic: SupportMessage = {
      id: `temp-${Date.now()}`,
      sender_type: 'user',
      sender_id: user?.id || '',
      content: text.trim(),
      created_at: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimistic]);
    setNewMessage('');
    setSending(true);

    if (sessionStatus === 'ai_active') {
      setBotTyping(true);
    }

    try {
      const data = await callSupportBot({
        action: 'send_message',
        sessionId,
        message: text.trim(),
      });

      if (data.response) {
        const aiMsg: SupportMessage = {
          id: `ai-${Date.now()}`,
          sender_type: 'ai',
          sender_id: null,
          content: data.response,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, aiMsg]);
      }

      if (data.status) {
        setSessionStatus(data.status);
      }
    } catch {
      const errMsg: SupportMessage = {
        id: `err-${Date.now()}`,
        sender_type: 'ai',
        sender_id: null,
        content: 'Sorry, something went wrong. Please try again.',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setSending(false);
      setBotTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleRequestHuman = async () => {
    if (!sessionId || sending) return;
    setSending(true);
    setBotTyping(true);

    try {
      const data = await callSupportBot({
        action: 'request_human',
        sessionId,
      });

      if (data.message) {
        const sysMsg: SupportMessage = {
          id: `sys-${Date.now()}`,
          sender_type: 'ai',
          sender_id: null,
          content: data.message,
          created_at: new Date().toISOString(),
        };
        setMessages(prev => [...prev, sysMsg]);
      }

      setSessionStatus('human_requested');
    } catch {
      setError('Failed to connect to support team');
    } finally {
      setSending(false);
      setBotTyping(false);
    }
  };

  const handleNewSession = async () => {
    if (sessionId) {
      try {
        await callSupportBot({ action: 'resolve', sessionId });
      } catch {}
    }
    setMessages([]);
    setSessionId(null);
    setSessionStatus('ai_active');
    setError(null);
    await initSession();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(newMessage);
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isHumanMode = sessionStatus === 'human_requested' || sessionStatus === 'human_active';

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center">
            <Bot className="w-8 h-8 text-blue-600" />
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
            <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
          </div>
        </div>
        <p className="text-sm text-gray-500 font-medium">Starting support chat...</p>
      </div>
    );
  }

  if (error && !sessionId) {
    return (
      <div className="h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <p className="text-gray-700 font-medium text-center">{error}</p>
        <button
          onClick={initSession}
          className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
        <button
          onClick={() => onNavigate('/support')}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Back to Support
        </button>
      </div>
    );
  }

  const showQuickActions = messages.length <= 1 && sessionStatus === 'ai_active';

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b shadow-sm flex-shrink-0">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('/support')}
              className="p-1.5 -ml-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                  isHumanMode ? 'bg-amber-500' : sessionStatus === 'resolved' ? 'bg-emerald-500' : 'bg-blue-600'
                }`}>
                  {isHumanMode ? (
                    <UserCheck className="w-5 h-5 text-white" />
                  ) : sessionStatus === 'resolved' ? (
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  ) : (
                    <Bot className="w-5 h-5 text-white" />
                  )}
                </div>
                <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
                  isHumanMode ? 'bg-amber-400' : sessionStatus === 'resolved' ? 'bg-gray-400' : 'bg-emerald-400'
                }`} />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-gray-900 leading-tight">
                  {isHumanMode ? 'Support Team' : sessionStatus === 'resolved' ? 'Chat Resolved' : 'MoveMe Support'}
                </h1>
                <p className="text-xs text-gray-500 leading-tight">
                  {sessionStatus === 'human_requested'
                    ? 'Waiting for agent...'
                    : sessionStatus === 'human_active'
                      ? 'Connected to agent'
                      : sessionStatus === 'resolved'
                        ? 'Session closed'
                        : botTyping
                          ? 'Typing...'
                          : 'AI Assistant'
                  }
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={handleNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            New Chat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-4 space-y-1">
          {messages.map((msg, idx) => {
            const isUser = msg.sender_type === 'user';
            const isAdmin = msg.sender_type === 'admin';
            const showAvatar = idx === 0 || messages[idx - 1]?.sender_type !== msg.sender_type;
            const isLastInGroup = idx === messages.length - 1 || messages[idx + 1]?.sender_type !== msg.sender_type;

            return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} ${showAvatar ? 'mt-3' : 'mt-0.5'}`}>
                {!isUser && showAvatar && (
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center mr-2 mt-1 flex-shrink-0 ${
                    isAdmin ? 'bg-amber-100' : 'bg-blue-100'
                  }`}>
                    {isAdmin ? (
                      <UserCheck className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                )}
                {!isUser && !showAvatar && <div className="w-7 mr-2 flex-shrink-0" />}
                <div className="max-w-[80%]">
                  <div
                    className={`px-3.5 py-2.5 text-sm leading-relaxed ${
                      isUser
                        ? 'bg-blue-600 text-white rounded-2xl rounded-br-md'
                        : isAdmin
                          ? 'bg-amber-50 border border-amber-200 text-gray-800 rounded-2xl rounded-bl-md'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-2xl rounded-bl-md shadow-sm'
                    }`}
                  >
                    {!isUser && showAvatar && (
                      <p className={`text-[10px] font-semibold mb-1 ${
                        isAdmin ? 'text-amber-600' : 'text-blue-500'
                      }`}>
                        {isAdmin ? 'Support Agent' : 'AI Assistant'}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {isLastInGroup && (
                    <p className={`text-[10px] mt-1 px-1 ${isUser ? 'text-right text-gray-400' : 'text-gray-400'}`}>
                      {formatTime(msg.created_at)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {botTyping && (
            <div className="flex justify-start mt-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center mr-2 mt-1 flex-shrink-0 bg-blue-100">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex gap-1.5">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {showQuickActions && (
          <div className="max-w-3xl mx-auto px-4 pb-4">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2 pl-1">Quick Questions</p>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.label)}
                  disabled={sending}
                  className="flex items-center gap-2 px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-left text-sm text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all disabled:opacity-50"
                >
                  <span className="text-base">{action.icon}</span>
                  <span className="line-clamp-1">{action.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 bg-white border-t">
        {sessionStatus === 'ai_active' && (
          <div className="max-w-3xl mx-auto px-4 pt-2">
            <button
              onClick={handleRequestHuman}
              disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50 mx-auto"
            >
              <HandHelping className="w-3.5 h-3.5" />
              Talk to a Real Person
            </button>
          </div>
        )}

        {sessionStatus === 'human_requested' && (
          <div className="max-w-3xl mx-auto px-4 pt-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin flex-shrink-0" />
              <p className="text-xs text-amber-700">
                Waiting for a support agent. A dispatcher will be with you shortly.
              </p>
            </div>
          </div>
        )}

        {sessionStatus === 'human_active' && (
          <div className="max-w-3xl mx-auto px-4 pt-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg">
              <UserCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <p className="text-xs text-emerald-700">
                You're connected with a support agent.
              </p>
            </div>
          </div>
        )}

        {sessionStatus === 'resolved' && (
          <div className="max-w-3xl mx-auto px-4 pt-2">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg">
              <CheckCircle2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <p className="text-xs text-gray-600">
                This session has been resolved. Start a new chat if you need more help.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={
                sessionStatus === 'resolved'
                  ? 'Start a new chat to continue...'
                  : isHumanMode
                    ? 'Message support team...'
                    : 'Ask a question...'
              }
              disabled={sending || sessionStatus === 'resolved'}
              className="flex-1 px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition-all disabled:opacity-50 placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || sending || sessionStatus === 'resolved'}
              className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
