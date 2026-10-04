import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import type { Appointment } from '@/types';

export interface TelemedicineJoinContext {
  sessionId: string;
  appointmentId: string;
  role: 'patient' | 'doctor';
  participantName: string;
  otherParticipantName: string;
  scheduledAt: string;
  durationMin: number;
  expiresAt: string;
  sessionStatus: 'waiting' | 'live' | 'ended' | 'cancelled';
  url: string;
  token: string;
}

export const telemedicineService = {
  videoAppointments: (): Promise<Appointment[]> =>
    unwrap<Appointment[]>(supabase.from('appointments')
      .select('*, doctors(specialty, profiles(full_name)), profiles!appointments_patient_id_fkey(full_name)')
      .eq('type', 'video')
      .not('status', 'in', '("cancelled","no_show")')
      .order('scheduled_at', { ascending: true })
      .limit(100)
    ).then((rows: any[]) => rows.map((r) => ({
      ...r,
      doctor_name: r.doctors?.profiles?.full_name,
      specialty: r.doctors?.specialty,
      patient_name: r.profiles?.full_name,
      doctors: undefined,
      profiles: undefined,
    }))),

  join: async (appointmentId: string): Promise<TelemedicineJoinContext> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Not authenticated');

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/daily-room`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ appointmentId }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Unable to join telemedicine session');
    return data as TelemedicineJoinContext;
  },

  markJoined: (sessionId: string) =>
    unwrap(supabase.rpc('mark_telemedicine_joined', { p_session_id: sessionId })),

  heartbeat: (sessionId: string) =>
    unwrap(supabase.rpc('heartbeat_telemedicine_session', { p_session_id: sessionId })),

  leave: (sessionId: string) =>
    unwrap(supabase.rpc('leave_telemedicine_session', { p_session_id: sessionId })),

  end: (sessionId: string) =>
    unwrap(supabase.rpc('end_telemedicine_session', { p_session_id: sessionId })),

  conversation: (appointmentId: string) =>
    unwrap(supabase.rpc('get_or_create_appointment_conversation', { p_appointment_id: appointmentId })),
};
