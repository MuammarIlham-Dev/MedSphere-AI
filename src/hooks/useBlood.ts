import { bloodService } from '@/services/blood.service';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
export function useMyBank() {
  return useQuery({ queryKey: ['my-bank'], queryFn: bloodService.myBank });
}

export function useBloodInventory(bankId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['blood-inventory', bankId],
    queryFn: () => { if (!bankId) throw new Error('bankId required'); return bloodService.inventory(bankId); },
    enabled: !!bankId,
  });
  useEffect(() => {
    if (!bankId) return;
    const ch = supabase.channel(`blood:${bankId}-${Date.now().toString()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blood_inventory', filter: `bank_id=eq.${bankId}` },
        () => qc.invalidateQueries({ queryKey: ['blood-inventory', bankId] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [bankId, qc]);
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
