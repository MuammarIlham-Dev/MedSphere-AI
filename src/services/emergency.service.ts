import { supabase } from '@/lib/supabase';
import { unwrap, ApiError } from '@/lib/api';
import { publish } from '@/lib/ably';
import type { Emergency } from '@/types';

export const emergencyService = {
  /** One-tap SOS: persist, then broadcast to regional operator channel. */
  async triggerSOS(input: { lat: number; lng: number; type?: string; address?: string; city?: string }): Promise<Emergency> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new ApiError('AUTH', 'Not signed in');
    const emergency = await unwrap<Emergency>(
      supabase.from('emergencies')
        .insert({ reporter_id: uid, lat: input.lat, lng: input.lng, type: input.type ?? 'medical', address: input.address })
        .select().single(),
    );
    await publish(`sos:${input.city ?? 'national'}`, 'sos:new', { emergency });
    return emergency;
  },

  get: (id: string) => unwrap<Emergency>(supabase.from('emergencies').select('*').eq('id', id).single()),

  /** Driver-side GPS stream → Ably (high frequency, no DB writes). */
  publishAmbulanceLocation: (ambulanceId: string, lat: number, lng: number) =>
    publish(`track:ambulance:${ambulanceId}`, 'track:loc', { ambulanceId, lat, lng, at: new Date().toISOString() }),

  listActive: () => unwrap<Emergency[]>(supabase.from('emergencies').select('*').in('status', ['active', 'dispatched', 'on_scene', 'transporting']).order('created_at', { ascending: false })),

  dispatchAmbulance: async (id: string, ambulanceId: string) => {
    return unwrap<Emergency>(supabase.from('emergencies').update({ status: 'dispatched', assigned_ambulance_id: ambulanceId }).eq('id', id).select().single());
  },
};
