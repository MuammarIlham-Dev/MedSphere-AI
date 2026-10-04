import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';

export interface HospitalAppointmentQueueRow {
  appointment_id: string; patient_id: string; patient_name: string; patient_phone: string | null;
  doctor_id: string; doctor_name: string; specialty: string | null; scheduled_at: string;
  duration_min: number; type: 'clinic' | 'video'; status: string; token_number: number;
  reason: string | null; amount_charged: number | null;
}

export const hospitalClinicalService = {
  queue: (hospitalId: string, includeVideo = true) =>
    unwrap<HospitalAppointmentQueueRow[]>(supabase.rpc('get_hospital_appointment_queue', {
      p_hospital_id: hospitalId, p_from: null, p_to: null, p_include_video: includeVideo,
    })),
  confirm: (appointmentId: string) =>
    unwrap<any>(supabase.rpc('hospital_confirm_appointment', { p_appointment_id: appointmentId })),
  checkIn: (appointmentId: string) =>
    unwrap<any>(supabase.rpc('hospital_check_in_appointment', { p_appointment_id: appointmentId })),
  noShow: (appointmentId: string, reason?: string) =>
    unwrap<any>(supabase.rpc('hospital_mark_no_show', { p_appointment_id: appointmentId, p_reason: reason?.trim() || null })),
};
