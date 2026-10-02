import { supabase } from '@/lib/supabase';
import { unwrap, ApiError } from '@/lib/api';
import type { Appointment, AppointmentStatus, BookAppointmentInput } from '@/types';

export const appointmentService = {
  async book(input: BookAppointmentInput): Promise<Appointment> {
    const uid = (await supabase.auth.getUser()).data.user?.id;
    if (!uid) throw new ApiError('AUTH', 'Not signed in');
    const dayStart = new Date(input.scheduled_at); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(input.scheduled_at); dayEnd.setHours(23, 59, 59, 999);
    const { count } = await supabase
      .from('appointments').select('id', { count: 'exact', head: true })
      .eq('doctor_id', input.doctor_id)
      .gte('scheduled_at', dayStart.toISOString()).lte('scheduled_at', dayEnd.toISOString());
    return unwrap<Appointment>(
      supabase.from('appointments')
        .insert({ ...input, patient_id: uid, token_number: (count ?? 0) + 1, status: 'booked' })
        .select().single(),
    );
  },

  mine: (): Promise<Appointment[]> =>
    unwrap(supabase.from('appointments')
      .select('*, doctors(specialty, profiles(full_name))')
      .order('scheduled_at', { ascending: true }).limit(100))
      .then((rows: any[]) =>
        rows.map((r) => ({ ...r, doctor_name: r.doctors?.profiles?.full_name, specialty: r.doctors?.specialty, doctors: undefined }))),

  todayQueue: async (doctorId: string): Promise<Appointment[]> => {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    return unwrap(supabase.from('appointments')
      .select('*, profiles!appointments_patient_id_fkey(full_name)')
      .eq('doctor_id', doctorId)
      .gte('scheduled_at', start.toISOString()).lte('scheduled_at', end.toISOString())
      .order('token_number'))
      .then((rows: any[]) => rows.map((r) => ({ ...r, patient_name: r.profiles?.full_name, profiles: undefined })));
  },

  setStatus: (id: string, status: AppointmentStatus, cancelReason?: string) =>
    unwrap(supabase.from('appointments')
      .update({ status, ...(cancelReason ? { cancel_reason: cancelReason } : {}) })
      .eq('id', id).select().single()),

  reschedule: (id: string, when: string) =>
    unwrap(supabase.from('appointments').update({ scheduled_at: when, status: 'rescheduled' }).eq('id', id).select().single()),
};
