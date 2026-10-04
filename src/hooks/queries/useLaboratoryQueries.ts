import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoryService } from '@/services/laboratory.service';
import { useUiStore } from '@/stores/uiStore';

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ['lab-orders'] });
  void qc.invalidateQueries({ queryKey: ['my-lab-reports'] });
  void qc.invalidateQueries({ queryKey: ['hospital-lab-orders'] });
};

export function useLabOrders(labId?: string) {
  return useQuery({
    queryKey: ['lab-orders', labId],
    queryFn: () => laboratoryService.worklist(labId!),
    enabled: !!labId,
    refetchInterval: 20_000,
  });
}

export function useAcceptLabOrder() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ orderId }: { orderId: string }) => laboratoryService.acceptOrder(orderId),
    onSuccess: () => { invalidate(qc); toast('success', 'Laboratory order accepted'); },
    onError: (error: Error) => toast('error', error.message),
  });
}

export function useAdvanceSampleStatus() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ itemId }: { itemId: string }) => laboratoryService.advanceSample(itemId),
    onSuccess: () => { invalidate(qc); toast('success', 'Sample pipeline advanced'); },
    onError: (error: Error) => toast('error', error.message),
  });
}

export function useCreateLabReport() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: (input: { orderId: string; testId: string; result: Record<string, unknown> }) =>
      laboratoryService.createReport(input),
    onSuccess: () => { invalidate(qc); toast('success', 'Laboratory report created'); },
    onError: (error: Error) => toast('error', error.message),
  });
}

export function useVerifyLabReport() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ reportId }: { reportId: string }) => laboratoryService.verifyReport(reportId),
    onSuccess: () => { invalidate(qc); toast('success', 'Laboratory report verified'); },
    onError: (error: Error) => toast('error', error.message),
  });
}

export function useDeliverLabReport() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ reportId }: { reportId: string }) => laboratoryService.deliverReport(reportId),
    onSuccess: () => { invalidate(qc); toast('success', 'Laboratory report delivered'); },
    onError: (error: Error) => toast('error', error.message),
  });
}
