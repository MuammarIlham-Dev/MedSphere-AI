import { PageTransition } from '@/components/transitions/PageTransition';
import { PageHeader, EmptyState, Skeleton, KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emergencyService } from '@/services/emergency.service';
import { formatDateTime } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
import { IoAlertCircleOutline, IoPulseOutline, IoLocationOutline, IoNavigateOutline } from 'react-icons/io5';
import { useRef, useEffect } from 'react';
import { useReveal } from '@/lib/gsap';
import { supabase } from '@/lib/supabase';

export default function EmergencyDashboard() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  
  const { data: emergencies, isLoading } = useQuery({
    queryKey: ['active-emergencies'],
    queryFn: emergencyService.listActive,
  });

  const dispatch = useMutation({
    mutationFn: ({ id, ambulanceId }: { id: string; ambulanceId: string }) => emergencyService.dispatchAmbulance(id, ambulanceId),
    onSuccess: () => {
      toast('success', 'Ambulance dispatched successfully.');
      qc.invalidateQueries({ queryKey: ['active-emergencies'] });
    },
    onError: (e) => toast('error', e.message),
  });

  useEffect(() => {
    const ch = supabase.channel('public:emergencies')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergencies' }, () => {
        qc.invalidateQueries({ queryKey: ['active-emergencies'] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [qc]);

  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  return (
    <PageTransition>
      <div ref={rootRef}>
        <PageHeader 
          title="Emergency Dispatch Dashboard" 
          subtitle="Live SOS alerts and ambulance dispatch coordination" 
        />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
          <KpiCard label="Active SOS" value={emergencies?.filter(e => e.status === 'active').length ?? 0} icon={<IoAlertCircleOutline className="w-5 h-5 text-danger-500" />} />
          <KpiCard label="Dispatched" value={emergencies?.filter(e => e.status !== 'active' && e.status !== 'resolved').length ?? 0} icon={<IoNavigateOutline className="w-5 h-5 text-info-500" />} />
        </div>

        <Card>
          <CardHeader title="Live SOS Feed" subtitle="Real-time emergency requests requiring immediate attention" />
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {isLoading && <div className="p-5"><Skeleton className="h-24 w-full" /></div>}
            {!isLoading && emergencies?.length === 0 && (
              <div className="p-10">
                <EmptyState title="No active emergencies" hint="The network is quiet. New SOS alerts will appear here." />
              </div>
            )}
            {emergencies?.map((e) => (
              <div key={e.id} className="p-5 flex flex-col md:flex-row gap-4 justify-between md:items-center">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <Badge tone={e.status === 'active' ? 'danger' : 'info'}>{e.status.toUpperCase()}</Badge>
                    <span className="text-sm font-semibold text-foreground">SOS-{e.id.slice(0, 6).toUpperCase()}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
                  </div>
                  <div className="space-y-1 text-sm text-foreground">
                    <div className="flex items-center gap-2">
                      <IoPulseOutline className="text-danger-500" />
                      <span>{e.type.charAt(0).toUpperCase() + e.type.slice(1)} Emergency</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <IoLocationOutline className="text-brand-500" />
                      <span className="font-mono">[{e.lat.toFixed(4)}, {e.lng.toFixed(4)}]</span>
                      {e.address && <span>— {e.address}</span>}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-2">
                  {e.status === 'active' ? (
                    <Button 
                      loading={dispatch.isPending}
                      onClick={() => {
                        const ambId = window.prompt("Enter Ambulance ID (e.g. AMB-001):");
                        if (ambId) {
                          dispatch.mutate({ id: e.id, ambulanceId: ambId });
                        }
                      }}
                    >
                      <IoNavigateOutline className="mr-2" />
                      Dispatch Ambulance
                    </Button>
                  ) : (
                    <div className="text-sm text-right">
                      <p className="font-semibold">Ambulance: {e.assigned_ambulance_id}</p>
                      <p className="text-xs text-muted-foreground tracking-widest mt-1">ON SCENE ETA: LIVE</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
