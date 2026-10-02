import { useQuery } from '@tanstack/react-query';
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
            doctor:doctor_id(full_name, specialty),
            items:prescription_items(
              *,
              medicine:medicine_id(name)
            )
          `)
          .eq('patient_id', profile!.id)
          .order('created_at', { ascending: false })
      );
      return data;
    },
    enabled: !!profile?.id,
  });
}
