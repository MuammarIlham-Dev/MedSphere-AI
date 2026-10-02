import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';

export const hospitalService = {
  getMyHospital: (ownerId: string) =>
    unwrap<any>(supabase.from('hospitals').select('*').eq('owner_id', ownerId).maybeSingle()),

  getHospitalsByCity: (city: string) => {
    let q = supabase.from('hospitals').select('*').eq('verification', 'verified');
    if (city) q = q.eq('city', city);
    return unwrap<any[]>(q);
  },

  getCities: async () => {
    const res = await supabase.from('hospitals').select('city').eq('verification', 'verified');
    if (res.error) throw res.error;
    const cities = new Set(res.data.map((h) => h.city).filter(Boolean));
    return Array.from(cities).sort();
  },

  getDepartments: async () => {
    // Basic distinct departments
    return ['ER', 'ICU', 'Surgery', 'Maternity', 'General', 'Pediatrics', 'Cardiology', 'Neurology', 'Orthopedics'];
  },

  updateCapacity: async (id: string, beds_available: number, icu_available: number) => {
    return unwrap<any>(
      supabase.from('hospitals')
        .update({ beds_available, icu_available })
        .eq('id', id)
        .select().single()
    );
  },
};
