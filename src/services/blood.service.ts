import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { BloodBank, BloodInventoryRow, BloodRequest, Urgency, BloodGroup } from '@/types';

export const bloodService = {
  myBank: async (): Promise<BloodBank | null> => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;
    const res = await supabase.from('blood_banks').select('*').eq('owner_id', uid).maybeSingle();
    return res.data as BloodBank | null;
  },

  inventory: (bankId: string) =>
    unwrap<BloodInventoryRow[]>(supabase.from('blood_inventory').select('*').eq('bank_id', bankId)),

  upsertInventory: (rows: Array<Pick<BloodInventoryRow, 'bank_id' | 'blood_group' | 'units_available' | 'units_reserved'>>) =>
    unwrap(supabase.from('blood_inventory').upsert(rows, { onConflict: 'bank_id,blood_group' }).select()),

  requests: (status?: string) => {
    let q = supabase.from('blood_requests').select('*').order('created_at', { ascending: false }).limit(100);
    if (status) q = q.eq('status', status);
    return unwrap<BloodRequest[]>(q);
  },

  createRequest: (input: { patient_name: string; blood_group: BloodGroup; units: number; urgency: Urgency; needed_by?: string; notes?: string }) =>
    supabase.auth.getUser().then(({ data }) =>
      unwrap<BloodRequest>(supabase.from('blood_requests')
        .insert({ ...input, requester_id: data.user?.id }).select().single())),

  nearbyBanks: (city: string) =>
    unwrap<BloodBank[]>(supabase.from('blood_banks').select('*').eq('city', city).eq('verification', 'verified')),
};
