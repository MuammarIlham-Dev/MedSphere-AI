import { useQuery } from '@tanstack/react-query';
import { hospitalLaboratoryService } from '@/services/hospitalLaboratory.service';

export function useHospitalLaboratoryOrders(hospitalId?: string) {
  return useQuery({
    queryKey: ['hospital-lab-orders', hospitalId],
    queryFn: () => hospitalLaboratoryService.orders(hospitalId!),
    enabled: !!hospitalId,
    refetchInterval: 20_000,
  });
}
