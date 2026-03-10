import { MessagesPage } from '../../components/messaging/MessagesPage';

interface CourierMessagesProps {
  onNavigate: (path: string) => void;
  initialConversationId?: string;
}

export function CourierMessages({ onNavigate, initialConversationId }: CourierMessagesProps) {
  return <MessagesPage onNavigate={onNavigate} initialConversationId={initialConversationId} />;
}
