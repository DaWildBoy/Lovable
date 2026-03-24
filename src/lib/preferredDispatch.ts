import { supabase } from './supabase';

const PREFERRED_PREVIEW_MINUTES = 5;

export function isRetailBusiness(businessType: string | null): boolean {
  return businessType === 'retail';
}

export async function getRetailPreferredCourierIds(retailProfileId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('retail_preferred_couriers')
    .select('courier_profile_id')
    .eq('retail_profile_id', retailProfileId);

  if (error || !data) return [];
  return data.map(r => r.courier_profile_id);
}

export function getPreferredDispatchExpiry(): string {
  return new Date(Date.now() + PREFERRED_PREVIEW_MINUTES * 60 * 1000).toISOString();
}

export async function isPreferredCourierForJob(
  jobCustomerId: string,
  courierUserId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('retail_preferred_couriers')
    .select('id')
    .eq('retail_profile_id', jobCustomerId)
    .eq('courier_profile_id', courierUserId)
    .maybeSingle();

  return !error && !!data;
}

export function isPreferredPreviewExpired(expiresAt: string | null): boolean {
  if (!expiresAt) return true;
  return new Date() >= new Date(expiresAt);
}

export async function transitionExpiredPreferredJobs(): Promise<number> {
  const { data, error } = await supabase
    .from('jobs')
    .update({ job_visibility: 'public' })
    .eq('job_visibility', 'preferred_preview')
    .lt('preferred_dispatch_expires_at', new Date().toISOString())
    .in('status', ['open', 'bidding'])
    .select('id');

  if (error) {
    console.error('Error transitioning preferred jobs:', error);
    return 0;
  }
  return data?.length || 0;
}
