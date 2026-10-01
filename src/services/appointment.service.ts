import { supabase } from '@/lib/supabase';
import { unwrap, ApiError } from '@/lib/api';
import type { Appointment, AppointmentStatus, BookAppointmentInput } from '@/types';

export const appointmentService = {
  async book(input: BookAppointmentInput): Promise<Appointment> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new ApiError('AUTH', 'Not signed in');
    return unwrap<Appointment>(supabase.rpc('book_appointment', {
      p_doctor_id: input.doctor_id,
      p_hospital_id: input.hospital_id,
      p_scheduled_at: input.scheduled_at,
      p_duration_min: 15,
      p_type: input.type,
      p_reason: input.reason ?? null,
    }));
  },

  mine: (): Promise<Appointment[]> =>
    unwrap<Array<Appointment & { doctors?: { specialty?: string; profiles?: { full_name: string } } }>>(supabase.from('appointments')
      .select('*, doctors(specialty, profiles(full_name))')
      .order('scheduled_at', { ascending: true }).limit(100))
      .then((rows) =>
        rows.map((r) => ({ ...r, doctor_name: r.doctors?.profiles?.full_name, specialty: r.doctors?.specialty, doctors: undefined }))),

  todayQueue: async (doctorId: string): Promise<Appointment[]> => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return unwrap<Array<Appointment & { profiles?: { full_name: string } }>>(supabase.from('appointments')
      .select('*, profiles!appointments_patient_id_fkey(full_name)')
      .eq('doctor_id', doctorId)
      .gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString())
      .order('token_number'))
      .then((rows) => rows.map((r) => ({ ...r, patient_name: r.profiles?.full_name, profiles: undefined })));
  },

  setStatus: (id: string, status: AppointmentStatus, cancelReason?: string) =>
    unwrap<Appointment>(supabase.rpc('transition_appointment', {
      p_appointment_id: id,
      p_status: status,
      p_reason: cancelReason ?? null,
    })),

  reschedule: (id: string, when: string) =>
    unwrap(supabase.from('appointments').update({ scheduled_at: when, status: 'rescheduled' }).eq('id', id).select().single()),
};
