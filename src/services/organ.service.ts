import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { OrganDonor, OrganMatch, OrganRecipient, OrganStats, RegisterDonorInput, RegisterRecipientInput } from '@/types';

export const organService = {
  getOrganDonorProfile: async (): Promise<OrganDonor | null> => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;
    const { data } = await supabase.from('organ_donors').select('*').eq('profile_id', uid).maybeSingle();
    return data;
  },

  registerDonor: async (input: RegisterDonorInput & { id?: string; has_consent?: boolean; consent_file_id?: string }): Promise<OrganDonor> => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new Error('Not authenticated');
    
    // Omit consent from upsert to avoid RLS restrictions on update
    const { has_consent, consent_file_id, id, ...rest } = input as any;
    
    const donor = await unwrap<OrganDonor>(supabase.from('organ_donors')
      .upsert({ ...rest, profile_id: uid }, { onConflict: 'profile_id' })
      .select().single());

    if (!donor) throw new Error('Failed to upsert donor profile');

    const newConsent = consent_file_id ? 'granted' : (has_consent ? 'pending' : 'withdrawn');
    
    return unwrap(supabase.rpc('update_organ_consent', { 
      p_donor_id: donor.id, 
      p_consent: newConsent, 
      p_file_id: consent_file_id || null 
    }));
  },

  withdrawConsent: async (donorId: string): Promise<OrganDonor> => {
    return unwrap(supabase.rpc('update_organ_consent', { p_donor_id: donorId, p_consent: 'withdrawn' }));
  },

  registerRecipient: async (input: RegisterRecipientInput): Promise<OrganRecipient> => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    return unwrap(supabase.from('organ_recipients').insert({ ...input, profile_id: uid }).select().single());
  },

  /** Coordinator-only: invokes the SQL matching engine (assistive scoring). */
  runMatching: (donorId: string) =>
    unwrap<number>(supabase.rpc('run_organ_matching', { p_donor: donorId })),

  listMatches: async (status?: string): Promise<OrganMatch[]> => {
    let q = supabase.from('organ_matches')
      .select(`*, organ_donors(profiles(full_name)), organ_recipients(priority_score, profiles(full_name))`)
      .order('compatibility_score', { ascending: false }).limit(100);
    if (status) q = q.eq('status', status);
    const rows = await unwrap<any[]>(q);
    return rows.map((r) => ({
      ...r,
      donor_name: r.organ_donors?.profiles?.full_name,
      recipient_name: r.organ_recipients?.profiles?.full_name,
      recipient_priority: r.organ_recipients?.priority_score,
      organ_donors: undefined, organ_recipients: undefined,
    }));
  },

  /** Human review decision — the engine never auto-accepts. */
  review: (matchId: string, approve: boolean, notes: string) =>
    unwrap(supabase.from('organ_matches')
      .update({ status: approve ? 'accepted' : 'rejected', notes, reviewed_at: new Date().toISOString() })
      .eq('id', matchId).select().single()),

  stats: async (): Promise<OrganStats> => {
    const [donors, waiting, matches] = await Promise.all([
      supabase.from('organ_donors').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('organ_recipients').select('organ_needed', { count: 'exact' }).eq('status', 'waiting'),
      supabase.from('organ_matches').select('status'),
    ]);
    const matchRows = (matches.data ?? []) as Array<{ status: string }>;
    const waitingRows = (waiting.data ?? []) as Array<{ organ_needed: OrganStats['byOrgan'][number]['organ'] }>;
    const byOrgan = Object.entries(
      waitingRows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.organ_needed]: (acc[r.organ_needed] ?? 0) + 1 }), {}),
    ).map(([organ, w]) => ({ organ: organ as OrganStats['byOrgan'][number]['organ'], waiting: w }));
    return {
      donors: donors.count ?? 0,
      waiting: waiting.count ?? 0,
      proposed: matchRows.filter((m) => m.status === 'proposed').length,
      accepted: matchRows.filter((m) => m.status === 'accepted').length,
      transplanted: matchRows.filter((m) => m.status === 'transplanted').length,
      byOrgan,
    };
  },
};
