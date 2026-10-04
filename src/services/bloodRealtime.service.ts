import { supabase } from '@/lib/supabase';

export type BloodRealtimeAction = 'created' | 'closed' | 'response_changed' | 'coverage_changed';

export async function publishBloodRealtime(requestId: string, action: BloodRealtimeAction) {
  const { error } = await supabase.functions.invoke('blood-ably-event', {
    body: { requestId, action },
  });
  if (error) throw error;
}

export const bloodRealtimeService = { publish: publishBloodRealtime };
