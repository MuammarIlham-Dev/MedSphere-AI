import * as Ably from 'ably';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emergencyChannel } from '@/lib/emergencyAbly';
import { emergencyService } from '@/services/emergency.service';
import { useUiStore } from '@/stores/uiStore';

export function useSOS() {
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: emergencyService.triggerSOS,
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['emergency', 'active'] }); },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'SOS failed — call local emergency number'),
  });
}

export function useEmergency(id: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['emergency', id],
    queryFn: () => emergencyService.get(id!),
    enabled: !!id,
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!id) return;
    const ch = emergencyChannel(`sos:emergency:${id}`);
    const onUpdate = () => { void qc.invalidateQueries({ queryKey: ['emergency', id] }); };
    void ch.subscribe('emergency:update', onUpdate);
    return () => { void ch.unsubscribe('emergency:update', onUpdate); };
  }, [id, qc]);

  return query;
}

export function useActiveEmergency() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['emergency', 'active'],
    queryFn: () => emergencyService.myActive(),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    const id = query.data?.id;
    if (!id) return;
    const ch = emergencyChannel(`sos:emergency:${id}`);
    const onUpdate = () => {
      void qc.invalidateQueries({ queryKey: ['emergency', 'active'] });
      void qc.invalidateQueries({ queryKey: ['emergency', id] });
    };
    void ch.subscribe('emergency:update', onUpdate);
    return () => { void ch.unsubscribe('emergency:update', onUpdate); };
  }, [query.data?.id, qc]);

  return query;
}

export function useAmbulanceTrack(ambulanceId: string | undefined) {
  const [loc, setLoc] = useState<{ lat: number; lng: number; at: string } | null>(null);

  useEffect(() => {
    if (!ambulanceId) {
      setLoc(null);
      return;
    }

    const ch = emergencyChannel(`track:ambulance:${ambulanceId}`);
    const onLoc = (msg: Ably.Message) => {
      const data = msg.data as { ambulanceId: string; lat: number; lng: number; at: string };
      setLoc({ lat: data.lat, lng: data.lng, at: data.at });
    };

    void ch.subscribe('track:loc', onLoc);
    return () => { void ch.unsubscribe('track:loc', onLoc); };
  }, [ambulanceId]);

  return loc;
}

export function useEmergencyDispatchCandidates(emergencyId: string | undefined) {
  return useQuery({
    queryKey: ['emergency-dispatch-candidates', emergencyId],
    queryFn: () => emergencyService.getDispatchCandidates(emergencyId!),
    enabled: !!emergencyId,
    staleTime: 5_000,
    refetchInterval: 15_000,
  });
}

export function useEmergencyCurrentDispatch(emergencyId: string | undefined) {
  return useQuery({
    queryKey: ['emergency-current-dispatch', emergencyId],
    queryFn: () => emergencyService.getCurrentDispatch(emergencyId!),
    enabled: !!emergencyId,
    staleTime: 5_000,
    refetchInterval: 10_000,
  });
}

export function useMyAmbulance() {
  return useQuery({
    queryKey: ['my-ambulance'],
    queryFn: emergencyService.getMyAmbulance,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useMyEmergencyDispatches(ambulanceId?: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['my-emergency-dispatches'],
    queryFn: emergencyService.getMyDispatches,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!ambulanceId) return;
    const ch = emergencyChannel(`sos:ambulance:${ambulanceId}`);
    const onUpdate = () => { void qc.invalidateQueries({ queryKey: ['my-emergency-dispatches'] }); };
    void ch.subscribe('emergency:update', onUpdate);
    return () => { void ch.unsubscribe('emergency:update', onUpdate); };
  }, [ambulanceId, qc]);

  return query;
}

export function useDispatchNearest() {
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: emergencyService.dispatchNearest,
    onSuccess: (_d, emergencyId) => {
      toast('success', 'Nearest available ambulance offered to the driver.');
      void qc.invalidateQueries({ queryKey: ['active-emergencies'] });
      void qc.invalidateQueries({ queryKey: ['emergency-current-dispatch', emergencyId] });
      void qc.invalidateQueries({ queryKey: ['emergency-dispatch-candidates', emergencyId] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Dispatch failed'),
  });
}

export function useCancelEmergencyDispatch() {
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ dispatchId, emergencyId }: { dispatchId: string; emergencyId: string }) =>
      emergencyService.cancelDispatch(dispatchId, emergencyId),
    onSuccess: () => {
      toast('success', 'Dispatch offer cancelled and ambulance released.');
      void qc.invalidateQueries({ queryKey: ['active-emergencies'] });
      void qc.invalidateQueries({ queryKey: ['emergency-dispatch-candidates'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to cancel dispatch'),
  });
}

export function useDriverDispatchAction() {
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { action: 'accept' | 'decline'; dispatchId: string }) =>
      input.action === 'accept'
        ? emergencyService.acceptDispatch(input.dispatchId)
        : emergencyService.declineDispatch(input.dispatchId),
    onSuccess: () => {
      toast('success', 'Dispatch updated.');
      void qc.invalidateQueries({ queryKey: ['my-emergency-dispatches'] });
      void qc.invalidateQueries({ queryKey: ['my-ambulance'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Dispatch action failed'),
  });
}

export function useEmergencyStatusAction() {
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ emergencyId, status }: { emergencyId: string; status: 'on_scene' | 'transporting' | 'arrived' | 'resolved' | 'cancelled' }) =>
      emergencyService.updateStatus(emergencyId, status),
    onSuccess: () => {
      toast('success', 'Emergency status updated.');
      void qc.invalidateQueries({ queryKey: ['my-emergency-dispatches'] });
      void qc.invalidateQueries({ queryKey: ['my-ambulance'] });
      void qc.invalidateQueries({ queryKey: ['active-emergencies'] });
      void qc.invalidateQueries({ queryKey: ['emergency', 'active'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Status update failed'),
  });
}
