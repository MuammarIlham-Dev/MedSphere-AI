import { useQuery } from '@tanstack/react-query';
import { doctorService } from '@/services/doctor.service';
import type { DoctorSearchFilters } from '@/types';
import { keepPreviousData } from '@tanstack/react-query';

export function useDoctorSearch(filters: DoctorSearchFilters) {
  return useQuery({
    queryKey: ['doctors', filters],
    queryFn: () => doctorService.search(filters),
    placeholderData: keepPreviousData,
  });
}

export function useDoctorSlots(doctorId: string | undefined, dateISO: string) {
  return useQuery({
    queryKey: ['slots', doctorId, dateISO],
    queryFn: () => doctorService.slots(doctorId!, dateISO),
    enabled: !!doctorId,
  });
}

export function useMyDoctor(profileId?: string) {
  return useQuery({
    queryKey: ['my-doctor', profileId],
    queryFn: () => doctorService.getMyDoctor(profileId!),
    enabled: !!profileId,
  });
}
