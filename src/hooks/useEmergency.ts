import * as Ably from 'ably';
import { emergencyService } from '@/services/emergency.service';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useUiStore } from '@/stores/uiStore';
import { ablyChannel } from '@/lib/ably';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
export function useSOS() {
  const toast = useUiStore((s) => s.toast);
  return useMutation({
    mutationFn: (params: Parameters<typeof emergencyService.triggerSOS>[0]) => emergencyService.triggerSOS(params),
    onError: (e) => { toast('error', e instanceof Error ? e.message : 'SOS failed — call local emergency number'); },
  });
}

export function useEmergency(id: string | undefined) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ['emergency', id],
    queryFn: () => emergencyService.get(id ?? ''),
    enabled: !!id,
  });
  useEffect(() => {
    if (!id) return;
    const ch = supabase.channel(`em:${id}-${Date.now().toString()}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'emergencies', filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ['emergency', id] }))
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [id, qc]);
  return query;
}

/** Live ambulance GPS over Ably. */
export function useAmbulanceTrack(ambulanceId: string | undefined) {
  const [loc, setLoc] = useState<{ lat: number; lng: number; at: string } | null>(null);
  useEffect(() => {
    if (!ambulanceId) return;
    const ch = ablyChannel(`track:ambulance:${ambulanceId}`);
    const onLoc = (msg: Ably.Message) => { setLoc(msg.data as { lat: number; lng: number; at: string }); };
    void ch.subscribe('track:loc', onLoc);
    return () => { ch.unsubscribe('track:loc', onLoc); };
  }, [ambulanceId]);
  return loc;
}
