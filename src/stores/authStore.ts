import { unwrap } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { closeAbly } from '@/lib/ably';
import { closeBloodAbly } from '@/lib/bloodAbly';
import { closeEmergencyAbly } from '@/lib/emergencyAbly';
import { queryClient } from '@/lib/queryClient';
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import type { Profile, Role } from '@/types';

type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

interface AuthState {
  status: AuthStatus;
  session: Session | null;
  profile: Profile | null;
  init: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  hasRole: (...roles: Role[]) => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,
  profile: null,

  init: async () => {
    if (import.meta.env.DEV && localStorage.getItem('dev_bypass') === '1') {
      const role = (localStorage.getItem('dev_role') as Role) || 'citizen';
      set({
        session: { access_token: 'dev', refresh_token: 'dev', expires_in: 9999, token_type: 'bearer', user: { id: 'dev-user-id', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' } } as any,
        profile: { id: 'dev-user-id', role, full_name: `Dev ${role}`, created_at: new Date().toISOString() } as Profile,
        status: 'signedIn',
      });
      return;
    }

    const { data } = await supabase.auth.getSession();
    set({ session: data.session });
    if (data.session) await get().refreshProfile();
    set({ status: data.session ? 'signedIn' : 'signedOut' });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (import.meta.env.DEV && localStorage.getItem('dev_bypass') === '1') return;
      set({ session, status: session ? 'signedIn' : 'signedOut' });
      if (session) await get().refreshProfile();
      else set({ profile: null });
      if (!session) { closeAbly(); closeBloodAbly(); closeEmergencyAbly(); }
    });
  },

  refreshProfile: async () => {
    if (import.meta.env.DEV && localStorage.getItem('dev_bypass') === '1') {
      const role = (localStorage.getItem('dev_role') as Role) || 'citizen';
      set({ profile: { id: 'dev-user-id', role, full_name: `Dev ${role}`, created_at: new Date().toISOString() } as Profile });
      return;
    }
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) return set({ profile: null });
    const profile = await unwrap<Profile>(
      supabase.from('profiles').select('*').eq('id', user.user.id).single(),
    );
    set({ profile });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    closeAbly();
    closeBloodAbly();
    closeEmergencyAbly();
    queryClient.clear();
    set({ session: null, profile: null, status: 'signedOut' });
  },

  hasRole: (...roles) => {
    const p = get().profile;
    return !!p && roles.includes(p.role);
  },
}));

useAuthStore.getState().init();
