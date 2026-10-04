import * as Ably from 'ably';
import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';

let realtime: Ably.Realtime | null = null;

export function getBloodAbly(): Ably.Realtime {
  if (realtime) return realtime;

  realtime = new Ably.Realtime({
    authUrl: `${env.supabaseUrl}/functions/v1/blood-ably-token`,
    authMethod: 'POST',
    authCallback: async (_, cb) => {
      const { data } = await supabase.auth.getSession();
      cb(null, data.session?.access_token ?? '');
    },
    autoConnect: true,
    disconnectedRetryTimeout: 3000,
    suspendedRetryTimeout: 10000,
  });

  return realtime;
}

export function bloodAblyChannel(name: string) {
  return getBloodAbly().channels.get(name);
}

export function closeBloodAbly() {
  realtime?.close();
  realtime = null;
}
