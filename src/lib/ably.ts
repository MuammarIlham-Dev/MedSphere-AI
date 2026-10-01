import { env } from './env';
import { supabase } from '@/lib/supabase';
import * as Ably from 'ably';
import type { AblyEventMap } from '@/types';

let realtime: Ably.Realtime | null = null;

export function getAbly(): Ably.Realtime {
  if (realtime) return realtime;
  realtime = new Ably.Realtime({
    authCallback: async (tokenParams, callback) => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error('Authentication required');
        const response = await fetch(env.ablyAuthUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(tokenParams),
        });
        if (!response.ok) throw new Error(`Realtime authorization failed (${response.status.toString()})`);
        const token = await response.json() as Ably.TokenDetails;
        callback(null, token);
      } catch (error) {
        callback(error as Ably.ErrorInfo, null);
      }
    },
    autoConnect: true,
    // Connection recovery: Ably resumes streams for up to 2 min after drops.
    disconnectedRetryTimeout: 5_000,
    suspendedRetryTimeout: 15_000,
  });
  return realtime;
}

export function ablyChannel(name: string) {
  return getAbly().channels.get(name);
}

export function publish<K extends keyof AblyEventMap>(channel: string, event: K, data: AblyEventMap[K]) {
  return ablyChannel(channel).publish(event as string, data as never);
}

export function closeAbly() {
  realtime?.close();
  realtime = null;
}
