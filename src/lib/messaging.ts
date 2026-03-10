import { supabase } from './supabase';

export async function getOrCreateJobConversation(jobId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_job_conversation', {
    p_job_id: jobId,
  });

  if (error) {
    console.error('Error getting/creating job conversation:', error);
    throw error;
  }

  if (!data) {
    throw new Error('No conversation ID returned');
  }

  return data as string;
}
