import { supabase } from '@/lib/supabase';

export type EmergencyRealtimeAction =
  | 'sos_created'
  | 'dispatch_offered'
  | 'dispatch_accepted'
  | 'dispatch_declined'
  | 'dispatch_cancelled'
  | 'status_changed'
  | 'agency_dispatches_changed'
  | 'agency_dispatch_acknowledged'
  | 'agency_dispatch_declined'
  | 'agency_dispatch_status_changed'
  | 'agency_dispatch_timed_out'
  | 'agency_dispatch_cancelled';

export async function publishEmergencyRealtime(
  action: EmergencyRealtimeAction,
  emergencyId: string,
  dispatchId?: string,
) {
  const { error } = await supabase.functions.invoke('emergency-ably-event', {
    body: { action, emergencyId, dispatchId: dispatchId ?? null },
  });
  if (error) throw error;
}

export const emergencyRealtimeService = {
  publish: publishEmergencyRealtime,
};
