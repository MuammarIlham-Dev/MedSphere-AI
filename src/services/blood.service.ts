import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { BloodBank, BloodInventoryRow, BloodRequest, Urgency, BloodGroup } from '@/types';

export const bloodService = {
  myBank: async (): Promise<BloodBank | null> => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) return null;
    const { data } = await supabase.from('blood_banks').select('*').eq('owner_id', uid).maybeSingle();
    return data as BloodBank | null;
  },

  inventory: (bankId: string) =>
    unwrap<BloodInventoryRow[]>(supabase.from('blood_inventory').select('*').eq('bank_id', bankId)),

  allInventories: () => 
    unwrap<any[]>(supabase.from('blood_inventory').select('*, blood_banks(name, city, lat, lng)')),

  upsertInventory: async (rows: Array<Pick<BloodInventoryRow, 'bank_id' | 'blood_group' | 'units_available'>>) =>
    Promise.all(rows.map((row) =>
      unwrap<BloodInventoryRow>(supabase.rpc('set_blood_inventory', {
        p_bank_id: row.bank_id,
        p_blood_group: row.blood_group,
        p_units_available: row.units_available,
      })),
    )),

  publicRequests: () =>
    unwrap<BloodRequest[]>(supabase.rpc('get_public_blood_requests')),

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

  getDonorProfile: async () => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new Error('Not authenticated');
    const { data, error } = await supabase.from('blood_donors').select('*').eq('profile_id', uid).maybeSingle();
    if (error) throw error;
    return data;
  },

  registerAsDonor: async (input: { blood_group: BloodGroup; is_available: boolean }) => {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new Error('Not authenticated');
    return unwrap(supabase.from('blood_donors').upsert({
      profile_id: uid,
      blood_group: input.blood_group,
      is_available: input.is_available,
    }, { onConflict: 'profile_id' }).select().single());
  },

  offerDonation: (requestId: string, units = 1) =>
    unwrap(supabase.rpc('offer_blood_donation', { p_request_id: requestId, p_units: units })),

  acceptDonationOffer: (offerId: string) =>
    unwrap(supabase.rpc('accept_blood_donation_offer', { p_offer_id: offerId })),

  confirmDonation: (offerId: string, bankId: string, units = 1) =>
    unwrap(supabase.rpc('confirm_blood_donation', {
      p_offer_id: offerId,
      p_bank_id: bankId,
      p_units: units,
    })),

  bankOffers: (bankId: string) =>
    unwrap<any[]>(supabase.rpc('get_blood_bank_offers', { p_bank_id: bankId })),

  nearbyDonors: (bloodGroup: string, lat: number, lng: number) => {
    // Basic implementation: fetch active donors with matching blood group.
    // Real implementation would use PostGIS or Haversine function via RPC for radius search.
    return unwrap(supabase.from('blood_donors')
      .select('*, profiles(full_name, city, lat, lng)')
      .eq('blood_group', bloodGroup)
      .eq('is_eligible', true)
      .limit(50));
  }
};
