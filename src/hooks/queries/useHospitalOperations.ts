import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { hospitalOperationsService } from '@/services/hospitalOperations.service';
import { useUiStore } from '@/stores/uiStore';

const invalidate = (qc: ReturnType<typeof useQueryClient>, hospitalId?: string) => {
  for (const key of ['hospital-beds', 'hospital-bed-requests', 'hospital-bed-reservations', 'hospital-admissions', 'hospital-clinicians', 'my-hospital']) {
    void qc.invalidateQueries({ queryKey: [key, hospitalId] });
  }
};

export const useHospitalClinicians = (hospitalId?: string) =>
  useQuery({
    queryKey: ['hospital-clinicians', hospitalId],
    queryFn: () => hospitalOperationsService.clinicians(hospitalId!),
    enabled: !!hospitalId,
    staleTime: 60_000,
  });

const useHospitalMutation = <TVariables, TResult>(
  mutationFn: (variables: TVariables) => Promise<TResult>,
  hospitalId?: string,
) => {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn,
    onSuccess: () => {
      invalidate(qc, hospitalId);
      toast('success', 'Hospital inpatient workflow updated');
    },
    onError: (error: Error) => toast('error', error.message),
  });
};

export const useRejectBedRequest = (hospitalId?: string) =>
  useHospitalMutation(
    ({ requestId, notes }: { requestId: string; notes?: string }) => hospitalOperationsService.rejectBedRequest(requestId, notes),
    hospitalId,
  );

export const useAssignAdmissionDoctor = (hospitalId?: string) =>
  useHospitalMutation(
    ({ admissionId, doctorId }: { admissionId: string; doctorId: string | null }) => hospitalOperationsService.assignAdmissionDoctor(admissionId, doctorId),
    hospitalId,
  );

export const useTransferAdmission = (hospitalId?: string) =>
  useHospitalMutation(
    ({ admissionId, targetBedId, reason, notes }: { admissionId: string; targetBedId: string; reason: string; notes?: string }) =>
      hospitalOperationsService.transferAdmission(admissionId, targetBedId, reason, notes),
    hospitalId,
  );

export const useDischargeInpatient = (hospitalId?: string) =>
  useHospitalMutation(
    ({ admissionId, notes }: { admissionId: string; notes?: string }) => hospitalOperationsService.dischargeAdmission(admissionId, notes),
    hospitalId,
  );
