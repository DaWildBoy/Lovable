export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  sender_type: 'user' | 'bot' | 'admin';
  content: string;
  created_at: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_metadata?: Record<string, unknown> | null;
  reply_to_message_id?: string | null;
  is_deleted?: boolean;
  sender_name?: string;
  sender_avatar?: string | null;
}

export interface Conversation {
  id: string;
  type: 'support' | 'job';
  job_id: string | null;
  status: 'active' | 'resolved' | 'escalated';
  last_message_at: string;
  unread_count: number;
  last_message?: {
    content: string;
    sender_type: 'user' | 'bot' | 'admin';
    attachment_type?: string | null;
  };
  job?: {
    pickup_location_text: string;
    dropoff_location_text: string;
    status: string;
  };
  other_participant?: {
    full_name: string;
    role: string;
    avatar_url?: string | null;
  };
}
