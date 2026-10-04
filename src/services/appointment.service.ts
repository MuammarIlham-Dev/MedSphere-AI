import { supabase } from '@/lib/supabase';
import { unwrap, ApiError } from '@/lib/api';
import type { Appointment, AppointmentStatus, BookAppointmentInput, ConsultationType } from '@/types';

export interface DoctorSchedule {
  id: string;
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  slot_minutes: number;
  is_active: boolean;
  type: ConsultationType;
  created_at?: string;
  updated_at?: string;
}

export interface DoctorSlot {
  slot_at: string;
  available: boolean;
}

export type DoctorScheduleInsert = Omit<DoctorSchedule, 'id' | 'created_at' | 'updated_at'> & { id?: string };

const DHakaToday = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;

  if (!year || !month || !day) throw new Error('Unable to determine Dhaka date');
  return `${year}-${month}-${day}`;
};

export const appointmentService = {
  async book(input: BookAppointmentInput): Promise<Appointment> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new ApiError('AUTH', 'Not signed in');

    return unwrap<Appointment>(
      supabase.rpc('book_appointment', {
        p_doctor_id: input.doctor_id,
        p_hospital_id: input.hospital_id,
        p_scheduled_at: input.scheduled_at,
        p_duration_min: input.duration_min,
        p_type: input.type,
        p_reason: input.reason
      })
    );
  },

  mine: (): Promise<Appointment[]> =>
    unwrap(supabase.from('appointments')
      .select('*, doctors(specialty, profiles(full_name))')
      .order('scheduled_at', { ascending: true }).limit(100))
      .then((rows: any[]) =>
        rows.map((r) => ({
          ...r,
          doctor_name: r.doctors?.profiles?.full_name,
          specialty: r.doctors?.specialty,
          doctors: undefined
        }))),

  todayQueue: async (doctorId: string): Promise<Appointment[]> => {
    const day = DHakaToday();

    return unwrap(supabase.from('appointments')
      .select('*, profiles!appointments_patient_id_fkey(full_name)')
      .eq('doctor_id', doctorId)
      .eq('day', day)
      .order('token_number'))
      .then((rows: any[]) =>
        rows.map((r) => ({
          ...r,
          patient_name: r.profiles?.full_name,
          profiles: undefined
        })));
  },

  setStatus: (id: string, status: AppointmentStatus, cancelReason?: string) =>
    unwrap(supabase.rpc('transition_appointment', {
      p_appointment_id: id,
      p_status: status,
      p_reason: cancelReason
    })),

  getAvailableSlots: async (
    doctorId: string,
    date: string,
    type: ConsultationType,
    excludeAppointmentId?: string
  ): Promise<DoctorSlot[]> =>
    unwrap(supabase.rpc('get_doctor_slots', {
      p_doctor_id: doctorId,
      p_date: date,
      p_type: type,
      p_exclude_appointment_id: excludeAppointmentId ?? null,
    })),

  reschedule: async (appointmentId: string, scheduledAt: string): Promise<Appointment> =>
    unwrap(supabase.rpc('reschedule_appointment', {
      p_appointment_id: appointmentId,
      p_scheduled_at: scheduledAt,
    })),

  getDoctorSchedules: async (doctorId: string): Promise<DoctorSchedule[]> =>
    unwrap(supabase.from('doctor_schedules')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('weekday')),

  setSchedule: async (schedule: DoctorScheduleInsert): Promise<DoctorSchedule> =>
    unwrap(supabase.from('doctor_schedules')
      .upsert(schedule, { onConflict: 'doctor_id,weekday,type' })
      .select()
      .single())
};
