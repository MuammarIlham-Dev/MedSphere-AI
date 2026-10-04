import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/stores/uiStore';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { ehrService } from '@/services/ehr.service';
import { useAuthStore } from '@/stores/authStore';

export function useMyMedicalRecords() {
  const profile = useAuthStore((s) => s.profile);
  return useQuery({
    queryKey: ['my-medical-records', profile?.id],
    queryFn: () => ehrService.records(profile!.id),
    enabled: !!profile?.id,
  });
}

export function useMyLabReports() {
  const profile = useAuthStore((s) => s.profile);
  return useQuery({
    queryKey: ['my-lab-reports', profile?.id],
    queryFn: () => ehrService.labReports(profile!.id),
    enabled: !!profile?.id,
  });
}

export function useLabReportHistory(reportId?: string) {
  return useQuery({
    queryKey: ['lab-report-history', reportId],
    queryFn: () => ehrService.labReportHistory(reportId!),
    enabled: !!reportId,
  });
}

export function useMyPrescriptions() {
  const profile = useAuthStore((s) => s.profile);
  return useQuery({
    queryKey: ['my-prescriptions', profile?.id],
    queryFn: async () => {
      const data = await unwrap<Array<{
        id: string;
        created_at: string;
        doctor?: { full_name: string, specialty: string };
        status: string;
        items?: Array<{ id: string; medicine?: { name: string }; dosage: string; frequency: string; duration_days: number }>;
      }>>(
        supabase
          .from('prescriptions')
          .select(`
            *,
            doctor:doctor_id(specialty, profiles(full_name)),
            items:prescription_items(
              *,
              medicine:medicine_id(name)
            )
          `)
          .eq('patient_id', profile!.id)
          .order('created_at', { ascending: false })
      );
      return data.map((d: any) => ({
        ...d,
        doctor: d.doctor ? {
          full_name: d.doctor.profiles?.full_name,
          specialty: d.doctor.specialty
        } : undefined
      }));
    },
    enabled: !!profile?.id,
  });
}


export function useMyPrescriptionShares() {
  const profile = useAuthStore((s) => s.profile);
  return useQuery({ queryKey: ['my-prescription-shares', profile?.id], queryFn: () => ehrService.prescriptionShares(profile!.id), enabled: !!profile?.id });
}

export function useVerifiedPharmacies() {
  return useQuery({ queryKey: ['verified-pharmacies'], queryFn: ehrService.pharmacies, staleTime: 60_000 });
}

export function useSharePrescription() {
  const qc = useQueryClient(); const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ prescriptionId, pharmacyId }: { prescriptionId: string; pharmacyId: string }) => ehrService.sharePrescription(prescriptionId, pharmacyId),
    onSuccess: () => { toast('success', 'Prescription shared with pharmacy'); void qc.invalidateQueries({ queryKey: ['my-prescription-shares'] }); },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to share prescription'),
  });
}

export function useCancelPrescriptionShare() {
  const qc = useQueryClient(); const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ehrService.cancelPrescriptionShare,
    onSuccess: () => { toast('success', 'Pharmacy access revoked'); void qc.invalidateQueries({ queryKey: ['my-prescription-shares'] }); },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to revoke pharmacy access'),
  });
}

export function useMyMedicationReminders() {
  const profile = useAuthStore((s) => s.profile);
  return useQuery({ queryKey: ['my-medication-reminders', profile?.id], queryFn: () => ehrService.medicationReminders(profile!.id), enabled: !!profile?.id });
}

export function useCreateMedicationReminder() {
  const profile = useAuthStore((s) => s.profile); const qc = useQueryClient(); const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: (input: { label: string; times: string[]; start_date: string; end_date?: string | null; is_active?: boolean }) => ehrService.createMedicationReminder(profile!.id, input),
    onSuccess: () => { toast('success', 'Medication schedule saved'); void qc.invalidateQueries({ queryKey: ['my-medication-reminders'] }); },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to save medication schedule'),
  });
}

export function useDeleteMedicationReminder() {
  const qc = useQueryClient(); const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ehrService.deleteMedicationReminder,
    onSuccess: () => { toast('success', 'Medication schedule removed'); void qc.invalidateQueries({ queryKey: ['my-medication-reminders'] }); },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to remove medication schedule'),
  });
}
