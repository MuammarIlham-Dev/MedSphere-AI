import { supabase } from '@/lib/supabase';
import { closeAbly } from '@/lib/ably';
import { queryClient } from '@/lib/queryClient';
import { unwrap } from '@/lib/api';
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

// ---------------------------------------------------------------------------
// DEV-ONLY mock profile — injected when localStorage has dev_bypass=1
// Never included in production builds (tree-shaken by import.meta.env.DEV).
// ---------------------------------------------------------------------------
function buildMockProfile(role: Role): Profile {
  return {
    id: 'dev-mock-user-id',
    role,
    full_name: `Dev ${role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}`,
    phone: '+8801700000000',
    dob: '1990-01-01',
    gender: 'male',
    blood_group: 'B+',
    avatar_url: null,
    digital_health_id: `DEV-${role.toUpperCase().slice(0, 4)}-0001`,
    address: 'House #474, Laxmipur, Rajshahi',
    city: 'Rajshahi',
    country: 'BD',
    lat: 24.3636,
    lng: 88.6241,
    emergency_contacts: [],
    mfa_enabled: false,
    onboarding_completed: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function isDevBypass(): boolean {
  return import.meta.env.DEV && localStorage.getItem('dev_bypass') === '1';
}

function getDevRole(): Role {
  const stored = localStorage.getItem('dev_role') as Role | null;
  const valid: Role[] = [
    'citizen', 'doctor', 'hospital', 'laboratory', 'pharmacy', 'blood_bank',
    'organ_authority', 'ambulance_driver', 'emergency_operator', 'government',
    'researcher', 'volunteer', 'admin', 'super_admin',
  ];
  return stored && valid.includes(stored) ? stored : 'citizen';
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: 'loading',
  session: null,
  profile: null,

  init: async () => {
    // ── DEV BYPASS ──────────────────────────────────────────────────────────
    if (isDevBypass()) {
      const role = getDevRole();
      set({ status: 'signedIn', session: null, profile: buildMockProfile(role) });
      return;
    }
    // ── NORMAL SUPABASE FLOW ─────────────────────────────────────────────────
    const { data } = await supabase.auth.getSession();
    set({ session: data.session });
    if (data.session) await get().refreshProfile();
    set({ status: data.session ? 'signedIn' : 'signedOut' });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session, status: session ? 'signedIn' : 'signedOut' });
      if (session) await get().refreshProfile();
      else set({ profile: null });
      if (!session) closeAbly();
    });
  },

  refreshProfile: async () => {
    if (isDevBypass()) {
      set({ profile: buildMockProfile(getDevRole()) });
      return;
    }
    const { data: user } = await supabase.auth.getUser();
    if (!user.user) { set({ profile: null }); return; }
    const profile = await unwrap<Profile>(
      supabase.from('profiles').select('*').eq('id', user.user.id).single(),
    );
    set({ profile });
  },

  signOut: async () => {
    if (isDevBypass()) {
      localStorage.removeItem('dev_bypass');
      set({ session: null, profile: null, status: 'signedOut' });
      window.location.href = '/login';
      return;
    }
    await supabase.auth.signOut();
    closeAbly();
    queryClient.clear();
    set({ session: null, profile: null, status: 'signedOut' });
  },

  hasRole: (...roles) => {
    const p = get().profile;
    return !!p && roles.includes(p.role);
  },
}));
