import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { bloodBroadcastService } from '@/services/bloodBroadcast.service';
import { useUiStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';
import { bloodAblyChannel } from '@/lib/bloodAbly';

export function useDonorBloodBroadcasts() {
  const qc = useQueryClient();
  const profile = useAuthStore(s => s.profile);
  const query = useQuery({
    queryKey: ['blood-broadcasts', 'donor'],
    queryFn: bloodBroadcastService.donorBroadcasts,
    refetchInterval: 60000,
  });

  useEffect(() => {
    const city = profile?.city?.trim().toLowerCase();
    if (!city) return;
    const channel = bloodAblyChannel('chat:blood:city:' + city);
    const onEvent = () => {
      void qc.invalidateQueries({ queryKey: ['blood-broadcasts', 'donor'] });
      void qc.invalidateQueries({ queryKey: ['blood-broadcast-responses', 'mine'] });
    };
    void channel.subscribe('blood:broadcast', onEvent);
    return () => { void channel.unsubscribe('blood:broadcast', onEvent); };
  }, [profile?.city, qc]);

  useEffect(() => {
    const city = profile?.city?.trim().toLowerCase();
    if (!city) return;
    const channel = bloodAblyChannel('chat:blood:city:' + city);
    const onEvent = () => {
      void qc.invalidateQueries({ queryKey: ['blood-broadcasts', 'donor'] });
      void qc.invalidateQueries({ queryKey: ['blood-broadcast-responses', 'mine'] });
    };
    void channel.subscribe('blood:broadcast', onEvent);
    return () => { void channel.unsubscribe('blood:broadcast', onEvent); };
  }, [profile?.city, qc]);

  return query;
}

export function useMyBloodBroadcastResponses() {
  return useQuery({
    queryKey: ['blood-broadcast-responses', 'mine'],
    queryFn: bloodBroadcastService.donorResponses,
    refetchInterval: 30000,
  });
}

export function useRespondToBloodBroadcast() {
  const qc = useQueryClient();
  const toast = useUiStore(s => s.toast);
  return useMutation({
    mutationFn: bloodBroadcastService.respond,
    onSuccess: () => {
      toast('success', 'You joined the donor response queue.');
      void qc.invalidateQueries({ queryKey: ['blood-broadcasts'] });
      void qc.invalidateQueries({ queryKey: ['blood-broadcast-responses'] });
    },
    onError: e => toast('error', e instanceof Error ? e.message : 'Unable to respond'),
  });
}

export function useWithdrawBloodBroadcastResponse() {
  const qc = useQueryClient();
  const toast = useUiStore(s => s.toast);
  return useMutation({
    mutationFn: bloodBroadcastService.withdraw,
    onSuccess: () => {
      toast('success', 'Your donor response was withdrawn.');
      void qc.invalidateQueries({ queryKey: ['blood-broadcasts'] });
      void qc.invalidateQueries({ queryKey: ['blood-broadcast-responses'] });
    },
    onError: e => toast('error', e instanceof Error ? e.message : 'Unable to withdraw'),
  });
}

export function useHospitalBloodBroadcasts(hospitalId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['hospital-blood-broadcasts', hospitalId],
    queryFn: () => bloodBroadcastService.hospitalBroadcasts(hospitalId!),
    enabled: !!hospitalId,
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (!hospitalId) return;
    const channel = bloodAblyChannel('chat:blood:hospital:' + hospitalId);
    const onEvent = () => {
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcasts', hospitalId] });
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcast-responses'] });
      void qc.invalidateQueries({ queryKey: ['blood-request-coverage'] });
    };
    void channel.subscribe('blood:broadcast', onEvent);
    return () => { void channel.unsubscribe('blood:broadcast', onEvent); };
  }, [hospitalId, qc]);

  return query;
}

export function useHospitalBloodBroadcastResponses(requestId?: string) {
  return useQuery({
    queryKey: ['hospital-blood-broadcast-responses', requestId],
    queryFn: () => bloodBroadcastService.hospitalResponses(requestId!),
    enabled: !!requestId,
    refetchInterval: 60000,
  });
}

export function useCreateHospitalBloodBroadcast() {
  const qc = useQueryClient();
  const toast = useUiStore(s => s.toast);
  return useMutation({
    mutationFn: bloodBroadcastService.createHospitalBroadcast,
    onSuccess: (_, v) => {
      toast('success', 'Blood broadcast activated');
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcasts', v.hospitalId] });
    },
    onError: e => toast('error', e instanceof Error ? e.message : 'Unable to activate blood broadcast'),
  });
}

export function useConfirmHospitalBloodResponse() {
  const qc = useQueryClient();
  const toast = useUiStore(s => s.toast);
  return useMutation({
    mutationFn: bloodBroadcastService.confirmResponse,
    onSuccess: () => {
      toast('success', 'Donor response confirmed');
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcast-responses'] });
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcasts'] });
      void qc.invalidateQueries({ queryKey: ['blood-request-coverage'] });
    },
    onError: e => toast('error', e instanceof Error ? e.message : 'Unable to confirm donor'),
  });
}

export function useDeclineHospitalBloodResponse() {
  const qc = useQueryClient();
  const toast = useUiStore(s => s.toast);
  return useMutation({
    mutationFn: bloodBroadcastService.declineResponse,
    onSuccess: () => {
      toast('success', 'Donor response declined');
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcast-responses'] });
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcasts'] });
    },
    onError: e => toast('error', e instanceof Error ? e.message : 'Unable to decline donor'),
  });
}

export function useCloseHospitalBloodBroadcast() {
  const qc = useQueryClient();
  const toast = useUiStore(s => s.toast);
  return useMutation({
    mutationFn: bloodBroadcastService.closeBroadcast,
    onSuccess: () => {
      toast('success', 'Blood broadcast closed');
      void qc.invalidateQueries({ queryKey: ['hospital-blood-broadcasts'] });
    },
    onError: e => toast('error', e instanceof Error ? e.message : 'Unable to close broadcast'),
  });
}
