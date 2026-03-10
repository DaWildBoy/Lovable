import { MessagesPage } from '../../components/messaging/MessagesPage';

interface CustomerMessagesProps {
  onNavigate: (path: string) => void;
  initialConversationId?: string;
}

export function CustomerMessages({ onNavigate, initialConversationId }: CustomerMessagesProps) {
  return <MessagesPage onNavigate={onNavigate} initialConversationId={initialConversationId} />;
}
