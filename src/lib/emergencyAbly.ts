import * as Ably from 'ably';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';

let realtime: Ably.Realtime | null = null;

export function getEmergencyAbly(): Ably.Realtime {
  if (realtime) return realtime;
  realtime = new Ably.Realtime({
    authUrl: `${env.supabaseUrl}/functions/v1/emergency-ably-token`,
    authMethod: 'POST',
    authCallback: async (_, cb) => {
      const { data } = await supabase.auth.getSession();
      cb(null, data.session?.access_token ?? '');
    },
    autoConnect: true,
    disconnectedRetryTimeout: 3_000,
    suspendedRetryTimeout: 10_000,
  });
  return realtime;
}

export function emergencyChannel(name: string) {
  return getEmergencyAbly().channels.get(name);
}

export async function authorizeEmergencyAbly() {
  return getEmergencyAbly().auth.authorize();
}

export function publishEmergencyLocation(
  ambulanceId: string,
  lat: number,
  lng: number,
) {
  return emergencyChannel(`track:ambulance:${ambulanceId}`).publish('track:loc', {
    ambulanceId,
    lat,
    lng,
    at: new Date().toISOString(),
  });
}

export function closeEmergencyAbly() {
  realtime?.close();
  realtime = null;
}
