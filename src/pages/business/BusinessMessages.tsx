import { MessagesPage } from '../../components/messaging/MessagesPage';

interface BusinessMessagesProps {
  onNavigate: (path: string) => void;
  initialConversationId?: string;
}

export function BusinessMessages({ onNavigate, initialConversationId }: BusinessMessagesProps) {
  return <MessagesPage onNavigate={onNavigate} initialConversationId={initialConversationId} />;
}
