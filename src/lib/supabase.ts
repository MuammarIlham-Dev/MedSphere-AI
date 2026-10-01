import { env } from './env';
import { createClient } from '@supabase/supabase-js';
// import type { Database } from '@/types/database.types'; // generated via `pnpm db:types`

export const supabase = createClient(/* <Database> */ env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: { params: { eventsPerSecond: 10 } },
});
