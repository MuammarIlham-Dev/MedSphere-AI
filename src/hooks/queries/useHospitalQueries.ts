import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { hospitalService } from '@/services/hospital.service';
import { useUiStore } from '@/stores/uiStore';

export function useMyHospital(profileId?: string) {
  return useQuery({
    queryKey: ['my-hospital', profileId],
    queryFn: () => hospitalService.getMyHospital(profileId!),
    enabled: !!profileId,
  });
}

export function useHospitalsByCity(city: string) {
  return useQuery({
    queryKey: ['hospitals', city],
    queryFn: () => hospitalService.getHospitalsByCity(city),
  });
}

export function useHospitalCities() {
  return useQuery({
    queryKey: ['hospital-cities'],
    queryFn: hospitalService.getCities,
  });
}

export function useHospitalDepartments() {
  return useQuery({
    queryKey: ['hospital-departments'],
    queryFn: hospitalService.getDepartments,
  });
}

export function useUpdateCapacity() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  
  return useMutation({
    mutationFn: ({ id, beds_available, icu_available }: { id: string, beds_available: number, icu_available: number }) => 
      hospitalService.updateCapacity(id, beds_available, icu_available),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['my-hospital'] });
      toast('success', 'Hospital capacity updated');
    },
    onError: (err) => {
      toast('error', err.message);
    }
  });
}
