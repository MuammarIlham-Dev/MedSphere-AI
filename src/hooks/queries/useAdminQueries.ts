import { useQuery } from '@tanstack/react-query';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { adminService } from '@/services/admin.service';
import { useUiStore } from '@/stores/uiStore';
export function usePendingRoleRequests() {
  return useQuery({ queryKey: ['pending-role-requests'], queryFn: adminService.pendingRoleRequests });
}

export function useResolveRoleRequest() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ profileId, approve }: { profileId: string; approve: boolean }) =>
      adminService.resolveRoleRequest(profileId, approve),
    onSuccess: (_data, variables) => {
      toast('success', variables.approve ? 'Professional role provisioned' : 'Role request rejected');
      void qc.invalidateQueries({ queryKey: ['pending-role-requests'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Role request update failed'),
  });
}

export function usePendingDoctors() {
  return useQuery({ queryKey: ['pending-doctors'], queryFn: adminService.pendingDoctors });
}

export function usePendingDoctorCredentials() {
  return useQuery({ queryKey: ['pending-doctor-credentials'], queryFn: adminService.pendingDoctorCredentials });
}

export function useReviewDoctorCredential() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'accepted' | 'rejected'; notes?: string }) =>
      adminService.reviewDoctorCredential(id, status, notes),
    onSuccess: () => {
      toast('success', 'Credential review saved');
      void qc.invalidateQueries({ queryKey: ['pending-doctor-credentials'] });
      void qc.invalidateQueries({ queryKey: ['pending-doctors'] });
      void qc.invalidateQueries({ queryKey: ['pending-doctor-credentials'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Credential review failed'),
  });
}

export function useVerifyDoctor() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ id, approve, reason }: { id: string; approve: boolean; reason?: string }) => adminService.verifyDoctor(id, approve, reason),
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
