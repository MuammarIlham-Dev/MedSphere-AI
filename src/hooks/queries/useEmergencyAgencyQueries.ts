import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emergencyChannel } from '@/lib/emergencyAbly';
import { emergencyAgencyService } from '@/services/emergencyAgency.service';
import type { EmergencyAgencyDispatchStatus } from '@/types/emergencyAgency';
import { useUiStore } from '@/stores/uiStore';

export function useMyEmergencyAgencies() {
  return useQuery({
    queryKey: ['my-emergency-agencies'],
    queryFn: emergencyAgencyService.myAgencies,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useMyEmergencyAgencyDispatches(agencyIds: string[] = []) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['my-emergency-agency-dispatches'],
    queryFn: emergencyAgencyService.myDispatches,
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (agencyIds.length === 0) return;
    const channels = agencyIds.map((id) => emergencyChannel(`sos:agency:${id}`));
    const onUpdate = () => { void qc.invalidateQueries({ queryKey: ['my-emergency-agency-dispatches'] }); };
    channels.forEach((channel) => { void channel.subscribe('emergency:update', onUpdate); });
    return () => {
      channels.forEach((channel) => { void channel.unsubscribe('emergency:update', onUpdate); });
    };
  }, [agencyIds.join('|'), qc]);

  return query;
}

export function useEmergencyAgencyDispatches(emergencyId: string | undefined, city?: string | null) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['emergency-agency-dispatches', emergencyId],
    queryFn: async () => {
      await emergencyAgencyService.escalate(emergencyId!);
      return emergencyAgencyService.operatorDispatches(emergencyId!);
    },
    enabled: !!emergencyId,
    staleTime: 3_000,
    refetchInterval: 10_000,
  });

  useEffect(() => {
    if (!emergencyId || !city) return;
    const ch = emergencyChannel(`sos:operator:${city}`);
    const onUpdate = () => { void qc.invalidateQueries({ queryKey: ['emergency-agency-dispatches', emergencyId] }); };
    void ch.subscribe('emergency:update', onUpdate);
    return () => { void ch.unsubscribe('emergency:update', onUpdate); };
  }, [emergencyId, city, qc]);

  return query;
}

export function useMyEmergencyAgencyResponse(emergencyId: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['my-emergency-agency-response', emergencyId],
    queryFn: () => emergencyAgencyService.myEmergencyResponse(emergencyId!),
    enabled: !!emergencyId,
    staleTime: 5_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!emergencyId) return;
    const ch = emergencyChannel(`sos:emergency:${emergencyId}`);
    const onUpdate = () => {
      void qc.invalidateQueries({ queryKey: ['my-emergency-agency-response', emergencyId] });
    };
    void ch.subscribe('emergency:update', onUpdate);
    return () => { void ch.unsubscribe('emergency:update', onUpdate); };
  }, [emergencyId, qc]);

  return query;
}

export function useDispatchRequiredEmergencyAgencies() {
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: emergencyAgencyService.dispatchRequired,
    onSuccess: (_rows, emergencyId) => {
      toast('success', 'Required emergency agencies have been dispatched.');
      void qc.invalidateQueries({ queryKey: ['emergency-agency-dispatches', emergencyId] });
      void qc.invalidateQueries({ queryKey: ['active-emergencies'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Agency dispatch failed'),
  });
}

export function useEmergencyAgencyDispatchAction() {
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      action: 'acknowledge' | 'decline';
      dispatchId: string;
      emergencyId: string;
    }) => input.action === 'acknowledge'
      ? emergencyAgencyService.acknowledge(input.dispatchId, input.emergencyId)
      : emergencyAgencyService.decline(input.dispatchId, input.emergencyId),
    onSuccess: () => {
      toast('success', 'Agency dispatch response recorded.');
      void qc.invalidateQueries({ queryKey: ['my-emergency-agency-dispatches'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to update agency dispatch'),
  });
}

export function useEmergencyAgencyCancelAction() {
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { dispatchId: string; emergencyId: string }) =>
      emergencyAgencyService.updateStatus(input.dispatchId, input.emergencyId, 'cancelled'),
    onSuccess: (_row, input) => {
      toast('success', 'Agency dispatch cancelled.');
      void qc.invalidateQueries({ queryKey: ['emergency-agency-dispatches', input.emergencyId] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to cancel agency dispatch'),
  });
}

export function useEmergencyAgencyStatusAction() {
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      dispatchId: string;
      emergencyId: string;
      status: Extract<EmergencyAgencyDispatchStatus, 'en_route' | 'on_scene' | 'completed'>;
      notes?: string;
    }) => emergencyAgencyService.updateStatus(input.dispatchId, input.emergencyId, input.status, input.notes),
    onSuccess: () => {
      toast('success', 'Agency response status updated.');
      void qc.invalidateQueries({ queryKey: ['my-emergency-agency-dispatches'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Unable to update agency status'),
  });
}
