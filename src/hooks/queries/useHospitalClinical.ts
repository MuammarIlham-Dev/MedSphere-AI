import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hospitalClinicalService } from '@/services/hospitalClinical.service';
import { useUiStore } from '@/stores/uiStore';

const invalidate = (qc: ReturnType<typeof useQueryClient>, hospitalId?: string) => {
  void qc.invalidateQueries({ queryKey: ['hospital-appointment-queue', hospitalId] });
  void qc.invalidateQueries({ queryKey: ['hospital-admissions', hospitalId] });
  void qc.invalidateQueries({ queryKey: ['appointments'] });
};

export const useHospitalAppointmentQueue = (hospitalId?: string, includeVideo = true) =>
  useQuery({
    queryKey: ['hospital-appointment-queue', hospitalId, includeVideo],
    queryFn: () => hospitalClinicalService.queue(hospitalId!, includeVideo),
    enabled: !!hospitalId,
    refetchInterval: 20_000,
  });

const mutation = <TVariables,>(fn: (v: TVariables) => Promise<unknown>, hospitalId?: string) => {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: fn,
    onSuccess: () => { invalidate(qc, hospitalId); toast('success', 'Appointment queue updated'); },
    onError: (error: Error) => toast('error', error.message),
  });
};

export const useHospitalConfirmAppointment = (hospitalId?: string) =>
  mutation(({ appointmentId }: { appointmentId: string }) => hospitalClinicalService.confirm(appointmentId), hospitalId);

export const useHospitalCheckIn = (hospitalId?: string) =>
  mutation(({ appointmentId }: { appointmentId: string }) => hospitalClinicalService.checkIn(appointmentId), hospitalId);

export const useHospitalNoShow = (hospitalId?: string) =>
  mutation(({ appointmentId, reason }: { appointmentId: string; reason?: string }) => hospitalClinicalService.noShow(appointmentId, reason), hospitalId);
