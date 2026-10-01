import { adminService } from '@/services/admin.service';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useUiStore } from '@/stores/uiStore';
import { useQuery } from '@tanstack/react-query';
export function usePendingDoctors() {
  return useQuery({ queryKey: ['pending-doctors'], queryFn: adminService.pendingDoctors });
}

export function useVerifyDoctor() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => adminService.verifyDoctor(id, approve),
    onSuccess: (_d, v) => {
      toast('success', v.approve ? 'Doctor verified' : 'Application rejected');
      void qc.invalidateQueries({ queryKey: ['pending-doctors'] });
    },
  });
}

export function useAuditLog(offset = 0) {
  return useQuery({ queryKey: ['audit', offset], queryFn: () => adminService.auditLog(offset) });
}

export function useGovOverview() {
  return useQuery({ queryKey: ['gov-overview'], queryFn: adminService.govOverview, refetchInterval: 60_000 });
}
