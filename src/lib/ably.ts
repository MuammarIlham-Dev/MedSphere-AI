import { supabase } from '@/lib/supabase';
import { env } from './env';
import * as Ably from 'ably';
import type { AblyEventMap } from '@/types';

let realtime: Ably.Realtime | null = null;

export function getAbly(): Ably.Realtime {
  if (realtime) return realtime;
  realtime = new Ably.Realtime({
    authUrl: env.ablyAuthUrl,
    authMethod: 'POST',
    authCallback: async (_, cb) => {
      const { data } = await supabase.auth.getSession();
      cb(null, data.session?.access_token ?? '');
    },
    autoConnect: true,
    // Connection recovery: Ably resumes streams for up to 2 min after drops.
    disconnectedRetryTimeout: 5_000,
    suspendedRetryTimeout: 15_000,
  });
  return realtime;
}

export function ablyChannel<K extends keyof AblyEventMap>(name: string) {
  return getAbly().channels.get(name);
}

export function publish<K extends keyof AblyEventMap>(channel: string, event: K, data: AblyEventMap[K]) {
  return ablyChannel(channel).publish(event as string, data as never);
}

export function closeAbly() {
  realtime?.close();
  realtime = null;
}
