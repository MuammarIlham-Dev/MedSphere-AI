import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
export interface TimeSlot { start: string; end: string; type: 'video' | 'clinic'; available: boolean; }

import { generateSlots } from '@/lib/utils';

import type { DoctorCard, DoctorSearchFilters, DoctorSchedule } from '@/types';

export const doctorService = {
  async getMyDoctor(profileId: string) {
    return unwrap<{ id: string; verification: string; specialty: string; rating_avg: number; rating_count: number; [key: string]: any } | null>(
      supabase.from('doctors').select('*').eq('profile_id', profileId).maybeSingle()
    );
  },

  async apply(profileId: string, data: { specialty: string; license_no: string; experience_years: number; qualifications: string[]; consultation_fee: number }) {
    return unwrap(
      supabase.from('doctors').insert({
        profile_id: profileId,
        specialty: data.specialty,
        license_no: data.license_no,
        experience_years: data.experience_years,
        qualifications: data.qualifications,
        consultation_fee: data.consultation_fee,
        verification: 'pending',
      })
    );
  },

  async search(filters: DoctorSearchFilters): Promise<DoctorCard[]> {
    let q = supabase
      .from('doctors')
      .select(`*, profiles!inner(full_name, avatar_url, gender), hospitals(name, city)`)
      .eq('verification', 'verified')
      .order('rating_avg', { ascending: false })
      .limit(50);
    if (filters.specialty) q = q.eq('specialty', filters.specialty);
    if (filters.language) q = q.contains('languages', [filters.language]);
    if (filters.query) q = q.ilike('profiles.full_name', `%${filters.query}%`);
    if (filters.gender) q = q.eq('profiles.gender', filters.gender);
    if (filters.city) q = q.eq('hospitals.city', filters.city);
    if (filters.type === 'video') q = q.eq('video_enabled', true);
    if (filters.type === 'clinic') q = q.eq('clinic_enabled', true);
    const rows = await unwrap<any[]>(q);
    return rows.map((r) => ({
      ...r,
      full_name: r.profiles.full_name,
      avatar_url: r.profiles.avatar_url,
      gender: r.profiles.gender,
      hospital_name: r.hospitals?.name ?? null,
      hospital_city: r.hospitals?.city ?? null,
      profiles: undefined,
      hospitals: undefined,
    }));
  },

  async slots(doctorId: string, dateISO: string): Promise<TimeSlot[]> {
    const date = new Date(dateISO);
    const schedules = await unwrap<DoctorSchedule[]>(
      supabase.from('doctor_schedules').select('*').eq('doctor_id', doctorId).eq('is_active', true),
    );
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    const booked = await unwrap<Array<{ scheduled_at: string }>>(
      supabase.from('appointments').select('scheduled_at').eq('doctor_id', doctorId)
        .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString())
        .not('status', 'in', '("cancelled","no_show")'),
    );
    return generateSlots(schedules, booked.map((b) => b.scheduled_at), date);
  },
};
