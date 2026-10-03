import { useQuery } from '@tanstack/react-query';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { organService } from '@/services/organ.service';
import { useUiStore } from '@/stores/uiStore';
export function useOrganMatches(status?: string) {
  return useQuery({ queryKey: ['organ-matches', status ?? 'all'], queryFn: () => organService.listMatches(status) });
}

export function useOrganStats() {
  return useQuery({ queryKey: ['organ-stats'], queryFn: organService.stats });
}

export function useReviewMatch() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ id, approve, notes }: { id: string; approve: boolean; notes: string }) =>
      organService.review(id, approve, notes),
    onSuccess: (_d, v) => {
      toast('success', v.approve ? 'Match accepted — proceed to clinical scheduling' : 'Match rejected');
      void qc.invalidateQueries({ queryKey: ['organ-matches'] });
      void qc.invalidateQueries({ queryKey: ['organ-stats'] });
    },
  });
}

export function useRunMatching() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: organService.runMatching,
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['organ-matches'] }),
  });
}

export function useOrganDonorProfile() {
  return useQuery({ queryKey: ['organ-donor-profile'], queryFn: organService.getOrganDonorProfile });
}

export function useRegisterDonor() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: organService.registerDonor,
    onSuccess: () => {
      toast('success', 'Donor registration submitted');
      void qc.invalidateQueries({ queryKey: ['organ-donor-profile'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Registration failed'),
  });
}

export function useWithdrawOrganConsent() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: organService.withdrawConsent,
    onSuccess: () => {
      toast('success', 'Consent withdrawn successfully');
      void qc.invalidateQueries({ queryKey: ['organ-donor-profile'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Action failed'),
  });
}

export function useRegisterRecipient() {
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: organService.registerRecipient,
    onSuccess: () => toast('success', 'Recipient added to waiting list'),
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Registration failed'),
  });
}
