import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Send, Loader2, Plus, ArrowDown, User, Phone, Video } from 'lucide-react';
import type { Message } from './types';
import { MessageBubble } from './MessageBubble';
import { VoiceRecorder } from './VoiceRecorder';
import { AttachmentSheet } from './AttachmentSheet';
import { MediaViewer } from './MediaViewer';
import { JobBanner } from './JobBanner';
import { CameraCapture } from './CameraCapture';

interface ChatViewProps {
  conversationId: string;
  onBack: () => void;
}

export function ChatView({ conversationId, onBack }: ChatViewProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [conversation, setConversation] = useState<any>(null);
  const [partnerName, setPartnerName] = useState('');
  const [partnerAvatar, setPartnerAvatar] = useState<string | null>(null);
  const [partnerPhone, setPartnerPhone] = useState<string | null>(null);
  const [jobCompleted, setJobCompleted] = useState(false);
  const [jobInfo, setJobInfo] = useState<{ pickup: string; dropoff: string; status: string } | null>(null);
  const [showAttachmentSheet, setShowAttachmentSheet] = useState(false);
  const [showRecorder, setShowRecorder] = useState(false);
  const [mediaViewer, setMediaViewer] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [cameraMode, setCameraMode] = useState<'photo' | 'video' | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileCacheRef = useRef<{ name: string; avatar: string | null } | null>(null);

  useEffect(() => {
    loadConversation();
    loadMessages();
    markAsRead();

    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev;
          const withoutTemp = prev.filter(m => {
            if (!m.id.startsWith('temp-')) return true;
            return m.content !== newMsg.content || m.sender_id !== newMsg.sender_id;
          });
          return [...withoutTemp, newMsg];
        });

        if (newMsg.sender_id && newMsg.sender_id !== user?.id) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, company_name, avatar_url')
            .eq('id', newMsg.sender_id)
            .maybeSingle();
          if (profile) {
            setMessages(prev =>
              prev.map(m => m.id === newMsg.id ? {
                ...m,
                sender_name: profile.company_name || profile.full_name || 'Unknown',
                sender_avatar: profile.avatar_url
              } : m)
            );
          }
        }
        markAsRead();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId, user]);

  useEffect(() => {
    if (!loading) scrollToBottom();
  }, [messages, loading]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 150;
    setShowScrollButton(!isNearBottom);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversation = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*, jobs(status, pickup_location_text, dropoff_location_text)')
      .eq('id', conversationId)
      .maybeSingle();

    if (!data) return;
    setConversation(data);

    if (data.type === 'job' && data.jobs) {
      const job = Array.isArray(data.jobs) ? data.jobs[0] : data.jobs;
      const completed = job?.status === 'completed' || job?.status === 'cancelled';
      setJobCompleted(completed);
      setJobInfo({
        pickup: job?.pickup_location_text || '',
        dropoff: job?.dropoff_location_text || '',
        status: job?.status || '',
      });
    }

    if (data.type === 'support') {
      setPartnerName('Customer Support');
      return;
    }

    const { data: participants } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversationId);

    if (participants) {
      const otherId = participants.find(p => p.user_id !== user?.id)?.user_id;
      if (otherId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, company_name, avatar_url, phone')
          .eq('id', otherId)
          .maybeSingle();
        if (profile) {
          setPartnerName(profile.company_name || profile.full_name || 'Unknown');
          setPartnerAvatar(profile.avatar_url);
          setPartnerPhone(profile.phone || null);
        }
      }
    }
  };

  const loadMessages = async () => {
    try {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (!data) { setLoading(false); return; }

      const senderIds = [...new Set(data.filter(m => m.sender_id).map(m => m.sender_id!))];
      const profileMap: Record<string, { name: string; avatar: string | null }> = {};

      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, company_name, avatar_url')
          .in('id', senderIds);

        if (profiles) {
          for (const p of profiles) {
            profileMap[p.id] = {
              name: p.company_name || p.full_name || 'Unknown',
              avatar: p.avatar_url
            };
          }
        }
      }

      setMessages(data.map(msg => ({
        ...msg,
        sender_name: msg.sender_id ? profileMap[msg.sender_id]?.name : undefined,
        sender_avatar: msg.sender_id ? profileMap[msg.sender_id]?.avatar : undefined,
      })));
    } catch (err) {
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!user) return;
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', user.id);
  };

  const getMyProfile = async () => {
    if (profileCacheRef.current) return profileCacheRef.current;
    if (!user) return { name: 'You', avatar: null };
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, company_name, avatar_url')
      .eq('id', user.id)
      .maybeSingle();
    const result = {
      name: profile?.company_name || profile?.full_name || 'You',
      avatar: profile?.avatar_url || null
    };
    profileCacheRef.current = result;
    return result;
  };

  const sendTextMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || sending || jobCompleted) return;
    const content = newMessage.trim();
    setNewMessage('');
    await sendMessage(content);
  };

  const sendMessage = async (content: string, _attachmentUrl?: string, _attachmentType?: string, metadata?: Record<string, unknown>) => {
    if (!user || jobCompleted) return;
    const wasSending = sending;
    setSending(true);

    const myProfile = await getMyProfile();

    const optimistic: Message = {
      id: `temp-${Date.now()}-${Math.random()}`,
      conversation_id: conversationId,
      sender_id: user.id,
      sender_type: 'user',
      content,
      attachment_url: _attachmentUrl,
      attachment_type: _attachmentType,
      attachment_metadata: metadata,
      created_at: new Date().toISOString(),
      sender_name: myProfile.name,
      sender_avatar: myProfile.avatar,
    };

    setMessages(prev => [...prev, optimistic]);

    try {
      if (conversation?.type === 'support') {
        const { data: { session } } = await supabase.auth.getSession();
        const accessToken = session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY;
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-support-bot`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ conversationId, message: content }),
          }
        );
        if (!response.ok) throw new Error('Bot response failed');
        setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      } else {
        const { data, error } = await supabase.rpc('send_message', {
          p_conversation_id: conversationId,
          p_content: content,
          p_attachment_url: _attachmentUrl || null,
          p_attachment_type: _attachmentType || null,
          p_attachment_metadata: metadata || null,
        });

        if (error) throw error;

        const serverMsg = data as Record<string, unknown>;
        setMessages(prev =>
          prev.map(m => m.id === optimistic.id ? {
            id: serverMsg.id as string,
            conversation_id: serverMsg.conversation_id as string,
            sender_id: serverMsg.sender_id as string,
            sender_type: serverMsg.sender_type as 'user',
            content: serverMsg.content as string,
            attachment_url: serverMsg.attachment_url as string | undefined,
            attachment_type: serverMsg.attachment_type as string | undefined,
            attachment_metadata: serverMsg.attachment_metadata as Record<string, unknown> | undefined,
            created_at: serverMsg.created_at as string,
            is_deleted: serverMsg.is_deleted as boolean,
            sender_name: myProfile.name,
            sender_avatar: myProfile.avatar,
          } : m)
        );
      }
    } catch (err) {
      console.error('Error sending:', err);
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  const uploadFile = async (file: File, type: 'image' | 'video' | 'document') => {
    if (!user || jobCompleted) return;
    setSending(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${conversationId}/${user.id}/${Date.now()}.${ext}`;
      const { data: upload, error } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(upload.path);

      const meta: Record<string, unknown> = {
        filename: file.name,
        size: file.size,
        mime: file.type,
      };

      await sendMessage('', publicUrl, type, meta);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload file. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const detectedType = file.type.startsWith('video/') ? 'video' : 'image';
      uploadFile(file, detectedType);
    }
    e.target.value = '';
  };

  const handleVoiceSend = async (blob: Blob, duration: number) => {
    if (!user || jobCompleted) return;
    setSending(true);
    try {
      const path = `${conversationId}/${user.id}/${Date.now()}.webm`;
      const { data: upload, error } = await supabase.storage
        .from('chat-attachments')
        .upload(path, blob);
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(upload.path);

      await sendMessage('Voice message', publicUrl, 'audio', { duration });
    } catch (err) {
      console.error('Voice upload failed:', err);
      alert('Failed to send voice message.');
    } finally {
      setSending(false);
    }
    setShowRecorder(false);
  };

  const handleLocationShare = () => {
    if (!('geolocation' in navigator)) {
      alert('Location sharing is not supported in your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const content = `https://maps.google.com/?q=${latitude},${longitude}`;
        sendMessage(content, undefined, 'location', { lat: latitude, lng: longitude });
      },
      () => alert('Unable to get your location. Please enable location services.')
    );
  };

  const handleCall = (video = false) => {
    if (!partnerPhone) {
      alert('Phone number not available for this contact.');
      return;
    }
    const formatted = partnerPhone.replace(/\s+/g, '');
    if (video) {
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        window.open(`facetime:${formatted}`, '_self');
      } else {
        window.open(`tel:${formatted}`, '_self');
      }
    } else {
      window.open(`tel:${formatted}`, '_self');
    }
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  let lastDate = '';
  let lastSenderId = '';

  if (loading) {
    return (
      <div className="flex flex-col h-[100dvh] bg-white">
        <div className="bg-white border-b p-4 flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mt-1" />
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-white">
      <div className="bg-white border-b shadow-sm">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>

          <div className="w-10 h-10 rounded-full overflow-hidden flex-shrink-0">
            {partnerAvatar ? (
              <img src={partnerAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-blue-100 flex items-center justify-center">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-gray-900 text-sm truncate">{partnerName}</h2>
            {jobCompleted ? (
              <p className="text-[11px] text-gray-400">Job completed</p>
            ) : (
              <p className="text-[11px] text-emerald-500 font-medium">Active</p>
            )}
          </div>

          {conversation?.type !== 'support' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleCall(false)}
                className="p-2.5 hover:bg-gray-100 rounded-full transition-colors"
                title="Voice call"
              >
                <Phone className="w-5 h-5 text-gray-600" />
              </button>
              <button
                onClick={() => handleCall(true)}
                className="p-2.5 hover:bg-gray-100 rounded-full transition-colors"
                title="Video call"
              >
                <Video className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          )}
        </div>

        {jobInfo && (
          <JobBanner
            pickup={jobInfo.pickup}
            dropoff={jobInfo.dropoff}
            status={jobInfo.status}
            jobCompleted={jobCompleted}
          />
        )}
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50/50"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Send className="w-7 h-7 text-gray-300" />
            </div>
            <p className="text-sm font-medium">No messages yet</p>
            <p className="text-xs mt-1">Send a message to start the conversation</p>
          </div>
        ) : (
          messages.map((msg) => {
            const msgDate = formatDate(msg.created_at);
            const showDateDivider = msgDate !== lastDate;
            lastDate = msgDate;

            const isOwn = msg.sender_id === user?.id;
            const showAvatar = !isOwn && msg.sender_id !== lastSenderId;
            lastSenderId = msg.sender_id || '';

            return (
              <div key={msg.id}>
                {showDateDivider && (
                  <div className="flex items-center justify-center my-4">
                    <span className="px-3 py-1 bg-white text-gray-500 text-[11px] font-medium rounded-full shadow-sm border border-gray-100">
                      {msgDate}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  isOwn={isOwn}
                  showAvatar={showAvatar}
                  onImageClick={(url) => setMediaViewer({ url, type: 'image' })}
                  onVideoClick={(url) => setMediaViewer({ url, type: 'video' })}
                />
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {showScrollButton && (
        <div className="relative">
          <button
            onClick={scrollToBottom}
            className="absolute -top-12 right-4 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-200 flex items-center justify-center hover:bg-gray-50 transition-colors z-10"
          >
            <ArrowDown className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}

      <div className="bg-white border-t border-gray-100 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex-shrink-0">
        {jobCompleted ? (
          <div className="flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-xl">
            <span className="text-sm text-gray-500">
              This conversation is closed. Messages are read-only.
            </span>
          </div>
        ) : showRecorder ? (
          <VoiceRecorder
            onSend={handleVoiceSend}
            onCancel={() => setShowRecorder(false)}
            disabled={sending}
          />
        ) : (
          <form onSubmit={sendTextMessage} className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setShowAttachmentSheet(true)}
              className="p-2.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors flex-shrink-0"
            >
              <Plus className="w-5 h-5" />
            </button>

            <div className="flex-1 relative">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="w-full px-4 py-2.5 bg-gray-100 border-0 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all disabled:opacity-50 placeholder:text-gray-400"
              />
            </div>

            {newMessage.trim() ? (
              <button
                type="submit"
                disabled={sending}
                className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-colors flex-shrink-0 disabled:opacity-50"
              >
                {sending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            ) : (
              <VoiceRecorder
                onSend={handleVoiceSend}
                onCancel={() => {}}
                disabled={sending}
              />
            )}
          </form>
        )}
      </div>

      <AttachmentSheet
        isOpen={showAttachmentSheet}
        onClose={() => setShowAttachmentSheet(false)}
        onCamera={() => setCameraMode('photo')}
        onGallery={() => fileInputRef.current?.click()}
        onVideo={() => setCameraMode('video')}
        onLocation={handleLocationShare}
      />

      {mediaViewer && (
        <MediaViewer
          url={mediaViewer.url}
          type={mediaViewer.type}
          onClose={() => setMediaViewer(null)}
        />
      )}

      {cameraMode && (
        <CameraCapture
          mode={cameraMode}
          onCapture={(file) => {
            setCameraMode(null);
            uploadFile(file, cameraMode === 'photo' ? 'image' : 'video');
          }}
          onClose={() => setCameraMode(null)}
        />
      )}

      <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
    </div>
  );
}
