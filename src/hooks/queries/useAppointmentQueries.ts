import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { appointmentService } from '@/services/appointment.service';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import type { AppointmentStatus } from '@/types';
export function useMyAppointments() {
  return useQuery({ queryKey: ['appointments', 'mine'], queryFn: appointmentService.mine });
}

export function useTodayQueue(doctorId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['queue', doctorId],
    queryFn: () => appointmentService.todayQueue(doctorId!),
    enabled: !!doctorId,
    refetchInterval: 30_000,
  });
  useEffect(() => {
    if (!doctorId) return;
    const ch = supabase.channel(`queue:${doctorId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments', filter: `doctor_id=eq.${doctorId}` },
        () => qc.invalidateQueries({ queryKey: ['queue', doctorId] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [doctorId, qc]);
  return query;
}

export function useBookAppointment() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: appointmentService.book,
    onSuccess: () => {
      toast('success', 'Appointment booked');
      void qc.invalidateQueries({ queryKey: ['appointments'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Booking failed'),
  });
}

export function useUpdateAppointmentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, reason }: { id: string; status: AppointmentStatus; reason?: string }) =>
      appointmentService.setStatus(id, status, reason),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['appointments'] });
      void qc.invalidateQueries({ queryKey: ['queue'] });
    },
  });
}

export function useDoctorSchedules(doctorId: string | undefined) {
  return useQuery({
    queryKey: ['schedules', doctorId],
    queryFn: () => appointmentService.getDoctorSchedules(doctorId!),
    enabled: !!doctorId,
  });
}

export function useUpdateSchedule() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: appointmentService.setSchedule,
    onSuccess: (data: any) => {
      toast('success', 'Schedule updated');
      void qc.invalidateQueries({ queryKey: ['schedules', data.doctor_id] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Update failed'),
  });
}
