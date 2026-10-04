import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { laboratoryService } from '@/services/laboratory.service';
import { useUiStore } from '@/stores/uiStore';

const invalidate = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ['lab-orders'] });
  void qc.invalidateQueries({ queryKey: ['my-lab-reports'] });
  void qc.invalidateQueries({ queryKey: ['hospital-lab-orders'] });
  void qc.invalidateQueries({ queryKey: ['lab-report-archive'] });
};

export function useLaboratoryWorkspace() {
  return useQuery({ queryKey: ['laboratory-workspace'], queryFn: laboratoryService.workspace, refetchInterval: 30_000 });
}

export function useLaboratoryMembers(labId?: string, enabled = true) {
  return useQuery({ queryKey: ['laboratory-members', labId], queryFn: () => laboratoryService.members(labId!), enabled: !!labId && enabled });
}

export function useAddLaboratoryMember() {
  const qc = useQueryClient(); const toast = useUiStore((s) => s.toast);
  return useMutation({ mutationFn: ({ labId, digitalHealthId, staffRole }: { labId: string; digitalHealthId: string; staffRole: string }) => laboratoryService.addMember(labId, digitalHealthId, staffRole), onSuccess: (_, v) => { void qc.invalidateQueries({ queryKey:['laboratory-members', v.labId] }); toast('success','Laboratory staff added'); }, onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to add laboratory staff') });
}

export function useRemoveLaboratoryMember() {
  const qc = useQueryClient(); const toast = useUiStore((s) => s.toast);
  return useMutation({ mutationFn: ({ memberId, labId }: { memberId: string; labId: string }) => laboratoryService.removeMember(memberId), onSuccess: (_, v) => { void qc.invalidateQueries({ queryKey:['laboratory-members', v.labId] }); toast('success','Laboratory staff access removed'); }, onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to remove laboratory staff') });
}

export function useLaboratoryReportArchive(labId?: string, enabled = true) {
  return useQuery({
    queryKey: ['lab-report-archive', labId],
    queryFn: () => laboratoryService.reportArchive(labId!),
    enabled: !!labId && enabled,
    refetchInterval: 30_000,
  });
}

export function useAmendLabReport() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: (input: { reportId: string; result: import('@/types/laboratory').StructuredLabResult; amendmentReason: string; file?: File | null }) =>
      laboratoryService.amendReport(input),
    onSuccess: () => { invalidate(qc); toast('success', 'Amendment created and queued for independent verification'); },
    onError: (error: Error) => toast('error', error.message),
  });
}

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
    mutationFn: (input: { orderId: string; testId: string; result: Record<string, unknown>; file?: File | null }) =>
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
