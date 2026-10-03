import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { bloodService } from '@/services/blood.service';
import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
export function useMyBank() {
  return useQuery({ queryKey: ['my-bank'], queryFn: bloodService.myBank });
}

export function useBloodInventory(bankId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['blood-inventory', bankId],
    queryFn: () => bloodService.inventory(bankId!),
    enabled: !!bankId,
  });
  useEffect(() => {
    if (!bankId) return;
    const ch = supabase.channel(`blood:${bankId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_inventory', filter: `bank_id=eq.${bankId}` },
        () => qc.invalidateQueries({ queryKey: ['blood-inventory', bankId] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [bankId, qc]);
  return query;
}

export function useAllBloodInventories() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['all-blood-inventories'],
    queryFn: bloodService.allInventories,
  });
  useEffect(() => {
    const ch = supabase.channel('all-blood-inventory')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_inventory' },
        () => qc.invalidateQueries({ queryKey: ['all-blood-inventories'] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);
  return query;
}

export function useBloodRequests(status?: string) {
  return useQuery({ queryKey: ['blood-requests', status ?? 'all'], queryFn: () => bloodService.requests(status) });
}

export function useCreateBloodRequest() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: bloodService.createRequest,
    onSuccess: () => {
      toast('success', 'Blood request broadcast');
      void qc.invalidateQueries({ queryKey: ['blood-requests'] });
    },
  });
}

export function useDonorProfile() {
  return useQuery({ queryKey: ['blood-donor-profile'], queryFn: bloodService.getDonorProfile });
}

export function useRegisterDonor() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: bloodService.registerAsDonor,
    onSuccess: () => {
      toast('success', 'Donor profile updated');
      void qc.invalidateQueries({ queryKey: ['blood-donor-profile'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Update failed'),
  });
}

export function useLogDonation() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ donorId, requestId }: { donorId: string, requestId?: string }) => bloodService.logDonation(donorId, requestId),
    onSuccess: () => {
      toast('success', 'Donation logged successfully');
      void qc.invalidateQueries({ queryKey: ['blood-donor-profile'] });
    },
  });
}

export function useNearbyDonors(bloodGroup: string, lat: number, lng: number) {
  return useQuery({
    queryKey: ['nearby-donors', bloodGroup, lat, lng],
    queryFn: () => bloodService.nearbyDonors(bloodGroup, lat, lng),
    enabled: !!bloodGroup,
  });
}
