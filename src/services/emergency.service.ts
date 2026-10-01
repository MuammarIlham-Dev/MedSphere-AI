import { publish } from '@/lib/ably';
import { supabase } from '@/lib/supabase';
import { unwrap, ApiError } from '@/lib/api';
import type { Emergency } from '@/types';

export const emergencyService = {
  /** Persist SOS durably; database Realtime notifies authorized operators. */
  async triggerSOS(input: { lat: number; lng: number; type?: string; address?: string; city?: string }): Promise<Emergency> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new ApiError('AUTH', 'Not signed in');
    const emergency = await unwrap<Emergency>(
      supabase.from('emergencies')
        .insert({ reporter_id: uid, lat: input.lat, lng: input.lng, type: input.type ?? 'medical', address: input.address })
        .select().single(),
    );
    return emergency;
  },

  get: (id: string) => unwrap<Emergency>(supabase.from('emergencies').select('*').eq('id', id).single()),

  /** Driver-side GPS stream → Ably (high frequency, no DB writes). */
  publishAmbulanceLocation: (ambulanceId: string, lat: number, lng: number) =>
    publish(`track:ambulance:${ambulanceId}`, 'track:loc', { ambulanceId, lat, lng, at: new Date().toISOString() }),
};
