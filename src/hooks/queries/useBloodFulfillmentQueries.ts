import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bloodFulfillmentService } from '@/services/bloodFulfillment.service';
import { useUiStore } from '@/stores/uiStore';
import { bloodAblyChannel } from '@/lib/bloodAbly';

export function useBloodRequestCoverage(requestId?: string, hospitalId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['blood-request-coverage', requestId],
    queryFn: () => bloodFulfillmentService.coverage(requestId!),
    enabled: !!requestId,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!requestId || !hospitalId) return;
    const channel = bloodAblyChannel('chat:blood:hospital:' + hospitalId);
    const onEvent = () => void qc.invalidateQueries({ queryKey: ['blood-request-coverage', requestId] });
    void channel.subscribe('blood:broadcast', onEvent);
    return () => { void channel.unsubscribe('blood:broadcast', onEvent); };
  }, [requestId, hospitalId, qc]);

  return query;
}

export function useBloodBankDonorCommitments(bankId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['blood-bank-donor-commitments', bankId],
    queryFn: () => bloodFulfillmentService.bankDonorCommitments(bankId!),
    enabled: !!bankId,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!bankId) return;
    // Bank commitment updates are broadcast on the hospital city channel so every
    // verified bank serving that city can refresh its authorized queue.
    let active = true;
    let cleanup: (() => void) | undefined;
    const resolve = async () => {
      const { data: bank } = await supabase.from('blood_banks').select('city').eq('id', bankId).maybeSingle();
      if (!active || !bank?.city) return;
      const channel = bloodAblyChannel('chat:blood:city:' + bank.city.trim().toLowerCase());
      const onEvent = () => void qc.invalidateQueries({ queryKey: ['blood-bank-donor-commitments', bankId] });
      void channel.subscribe('blood:broadcast', onEvent);
      cleanup = () => { void channel.unsubscribe('blood:broadcast', onEvent); };
    };
    void resolve();
    return () => { active = false; cleanup?.(); };
  }, [bankId, qc]);

  return query;
}

export function useConfirmBroadcastDonorDonation() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: ({ responseId, bankId, units }: { responseId: string; bankId: string; units?: number }) =>
      bloodFulfillmentService.confirmDonorDonation(responseId, bankId, units),
    onSuccess: () => {
      toast('success', 'Donor donation recorded and request coverage updated');
      void qc.invalidateQueries({ queryKey: ['blood-bank-donor-commitments'] });
      void qc.invalidateQueries({ queryKey: ['blood-request-coverage'] });
      void qc.invalidateQueries({ queryKey: ['blood-bank-offers'] });
      void qc.invalidateQueries({ queryKey: ['blood-donor-profile'] });
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcasts'] });
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcast-responses'] });
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'Unable to record donor donation'),
  });
}
