export interface TimeSlot { start: string; end: string; type: 'video' | 'clinic'; available: boolean; }

function timeToMinutes(value: string): number {
  const [hours = 0, minutes = 0] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function atMinute(date: string, minute: number): string {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${date}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

export function generateScheduleSlots(date: string, schedules: DoctorSchedule[], bookedAt: string[]): TimeSlot[] {
  const weekday = new Date(`${date}T00:00:00`).getDay();
  const occupied = new Set(bookedAt.map((value) => new Date(value).getTime()));

  return schedules
    .filter((schedule) => schedule.is_active && schedule.weekday === weekday)
    .flatMap((schedule) => {
      const slots: TimeSlot[] = [];
      const start = timeToMinutes(schedule.start_time);
      const end = timeToMinutes(schedule.end_time);
      for (let minute = start; minute + schedule.slot_minutes <= end; minute += schedule.slot_minutes) {
        const slotStart = atMinute(date, minute);
        slots.push({
          start: slotStart,
          end: atMinute(date, minute + schedule.slot_minutes),
          type: schedule.type,
          available: !occupied.has(new Date(slotStart).getTime()) && new Date(slotStart).getTime() > Date.now(),
        });
      }
      return slots;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { DoctorCard, DoctorSearchFilters, DoctorSchedule, Gender } from '@/types';

export const doctorService = {
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
    const rows = await unwrap<Array<Omit<DoctorCard, 'full_name' | 'avatar_url' | 'gender' | 'hospital_name' | 'hospital_city'> & { profiles: { full_name: string; avatar_url?: string; gender?: Gender }; hospitals?: { name: string; city: string } }>>(q);
    return rows.map((r) => ({
      ...r,
      full_name: r.profiles.full_name,
      avatar_url: r.profiles.avatar_url ?? null,
      gender: r.profiles.gender ?? null,
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
    const dISO = dateISO.slice(0, 10);
    return generateScheduleSlots(dISO, schedules, booked.map((appointment) => appointment.scheduled_at));
  },
};
