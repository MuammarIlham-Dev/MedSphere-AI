import { useQuery } from '@tanstack/react-query';
import { telemedicineService } from '@/services/telemedicine.service';

export function useVideoAppointments() {
  return useQuery({
    queryKey: ['telemedicine-appointments'],
    queryFn: telemedicineService.videoAppointments,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}
