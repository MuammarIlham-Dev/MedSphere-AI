import { supabase } from '@/lib/supabase';

export type EmergencyRealtimeAction =
  | 'sos_created'
  | 'dispatch_offered'
  | 'dispatch_accepted'
  | 'dispatch_declined'
  | 'dispatch_cancelled'
  | 'status_changed';

export async function publishEmergencyRealtime(
  action: EmergencyRealtimeAction,
  emergencyId: string,
) {
  const { error } = await supabase.functions.invoke('emergency-ably-event', {
    body: { action, emergencyId },
  });
  if (error) throw error;
}

export const emergencyRealtimeService = {
  publish: publishEmergencyRealtime,
};
