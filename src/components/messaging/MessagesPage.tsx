import { useState } from 'react';
import { Headphones } from 'lucide-react';
import { MessageList } from './MessageList';
import { ChatView } from './ChatView';

interface MessagesPageProps {
  onNavigate: (path: string) => void;
  initialConversationId?: string;
}

export function MessagesPage({ onNavigate, initialConversationId }: MessagesPageProps) {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(initialConversationId || null);

  const handleSelectConversation = (id: string, isSupport?: boolean) => {
    if (isSupport) {
      onNavigate('/support/chat');
    } else {
      setSelectedConversationId(id);
    }
  };

  if (selectedConversationId) {
    return (
      <div className="fixed inset-0 z-[60] bg-white flex flex-col">
        <ChatView
          conversationId={selectedConversationId}
          onBack={() => setSelectedConversationId(null)}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-20 md:pb-8">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Messages</h1>
          <button
            onClick={() => onNavigate('/support/chat')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-full hover:bg-emerald-700 transition-colors text-xs font-semibold shadow-sm"
          >
            <Headphones className="w-3.5 h-3.5" />
            Support
          </button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <MessageList
          onSelectConversation={handleSelectConversation}
          selectedConversationId={selectedConversationId || undefined}
        />
      </div>
    </div>
  );
}
