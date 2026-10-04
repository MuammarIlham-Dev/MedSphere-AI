import { useEffect, useState } from 'react';
import { PageTransition } from '@/components/transitions/PageTransition';
import { PageHeader, EmptyState, Skeleton, KpiCard } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IoAlertCircleOutline, IoPulseOutline, IoLocationOutline, IoNavigateOutline, IoCheckmarkCircleOutline, IoCloseCircleOutline, IoRefreshOutline } from 'react-icons/io5';
import {
  useAmbulanceTrack,
  useEmergencyCurrentDispatch,
  useEmergencyDispatchCandidates,
  useEmergencyStatusAction,
  useDispatchNearest,
  useCancelEmergencyDispatch,
} from '@/hooks/queries/useEmergencyQueries';
import {
  useEmergencyAgencyDispatches,
  useDispatchRequiredEmergencyAgencies,
  useEmergencyAgencyCancelAction,
  useResolveNonAmbulanceEmergency,
} from '@/hooks/queries/useEmergencyAgencyQueries';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { emergencyService } from '@/services/emergency.service';
import { formatDateTime } from '@/lib/utils';
import { emergencyChannel } from '@/lib/emergencyAbly';
import { useAuthStore } from '@/stores/authStore';

function LiveLocation({ ambulanceId }: { ambulanceId: string | null }) {
  const location = useAmbulanceTrack(ambulanceId ?? undefined);
  if (!ambulanceId) return null;
  return (
    <div className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> Ambulance GPS
      </div>
      {location ? (
        <>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{location.lat.toFixed(5)}, {location.lng.toFixed(5)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Updated {formatDateTime(location.at)}</p>
        </>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">Waiting for the driver's next GPS sample.</p>
      )}
    </div>
  );
}

export default function EmergencyDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string>();
  const { data: emergencies, isLoading } = useQuery({
    queryKey: ['active-emergencies'],
    queryFn: emergencyService.listActive,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (!profile?.city) return;
    const ch = emergencyChannel(`sos:operator:${profile.city}`);
    const onUpdate = () => {
      void qc.invalidateQueries({ queryKey: ['active-emergencies'] });
      if (selectedId) {
        void qc.invalidateQueries({ queryKey: ['emergency-current-dispatch', selectedId] });
        void qc.invalidateQueries({ queryKey: ['emergency-dispatch-candidates', selectedId] });
      }
    };
    void ch.subscribe('emergency:update', onUpdate);
    return () => { void ch.unsubscribe('emergency:update', onUpdate); };
  }, [profile?.city, qc, selectedId]);
  const selected = emergencies?.find((e) => e.id === selectedId);
  const candidates = useEmergencyDispatchCandidates(selectedId);
  const currentDispatch = useEmergencyCurrentDispatch(selectedId);
  const agencyDispatches = useEmergencyAgencyDispatches(selectedId, profile?.city);
  const dispatchNearest = useDispatchNearest();
  const dispatchAgencies = useDispatchRequiredEmergencyAgencies();
  const cancelDispatch = useCancelEmergencyDispatch();
  const cancelAgencyDispatch = useEmergencyAgencyCancelAction();
  const statusAction = useEmergencyStatusAction();
  const resolveNonAmbulance = useResolveNonAmbulanceEmergency();

  return (
    <PageTransition>
      <PageHeader title="Emergency Dispatch" subtitle="Region-scoped SOS operations, nearest-ambulance routing, responder acknowledgement, and live vehicle telemetry." />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active SOS" value={emergencies?.filter((e) => e.status === 'active').length ?? 0} icon={<IoAlertCircleOutline className="h-5 w-5 text-danger-500" />} />
        <KpiCard label="On response" value={emergencies?.filter((e) => ['dispatched','on_scene','transporting','arrived'].includes(e.status)).length ?? 0} icon={<IoNavigateOutline className="h-5 w-5 text-info-500" />} />
        <KpiCard label="Awaiting acknowledgement" value={emergencies?.filter((e) => e.status === 'active').length ?? 0} icon={<IoPulseOutline className="h-5 w-5 text-warning-500" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader title="Live SOS feed" subtitle="Operators see only events within their dispatch region." />
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {isLoading && <div className="p-5"><Skeleton className="h-28 w-full" /></div>}
            {!isLoading && emergencies?.length === 0 && <div className="p-10"><EmptyState title="No active emergencies" hint="New SOS events arrive through Ably, with database polling as the fallback." /></div>}
            {emergencies?.map((e) => {
              const dispatchable = e.status === 'active' && ['medical','accident','other'].includes(e.type);
              return (
                <div
                  key={e.id}
                  className={`flex flex-col gap-4 p-5 transition hover:bg-slate-50 dark:hover:bg-surface-dark-muted lg:flex-row lg:items-center lg:justify-between ${e.id === selectedId ? 'bg-brand-50/50 dark:bg-brand-950/20' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    aria-label={`Select SOS-${e.id.slice(0, 6).toUpperCase()}`}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={e.status === 'active' ? 'danger' : 'info'}>{e.status.replace('_',' ').toUpperCase()}</Badge>
                      <span className="text-sm font-semibold">SOS-{e.id.slice(0, 6).toUpperCase()}</span>
                      <span className="text-xs text-muted-foreground">{e.city ?? 'National'}</span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                      <span className="flex items-center gap-2"><IoPulseOutline className="text-danger-500" />{e.type} emergency</span>
                      <span className="flex items-center gap-2"><IoLocationOutline className="text-brand-500" />{e.lat.toFixed(4)}, {e.lng.toFixed(4)}</span>
                    </div>
                    {e.address && <p className="mt-1 truncate text-xs text-muted-foreground">{e.address}</p>}
                  </button>

                  <div className="shrink-0">
                    {dispatchable && (
                      <Button
                        onClick={() => dispatchNearest.mutate(e.id)}
                        loading={dispatchNearest.isPending && dispatchNearest.variables === e.id}
                      >
                        <IoNavigateOutline className="mr-2" /> Offer nearest
                      </Button>
                    )}
                    {e.status === 'active' && !dispatchable && (
                      <span className="rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-xs font-medium text-warning-800 dark:border-warning-900 dark:bg-warning-950/30 dark:text-warning-300">
                        {e.type === 'fire' ? 'Fire agency required' : e.type === 'police' ? 'Police agency required' : 'Specialized routing'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card>
          <CardHeader title={selected ? `SOS-${selected.id.slice(0,6).toUpperCase()}` : 'Select an emergency'} subtitle={selected ? 'Dispatch control center' : 'Choose an event from the live feed.'} />
          {!selected && <div className="p-8"><EmptyState title="No event selected" hint="Select an SOS to view responder availability and the current dispatch state." /></div>}
          {selected && (
            <div className="space-y-4 p-5">
              <div className="rounded-2xl bg-surface-muted p-4 dark:bg-surface-dark-muted">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold">Current state</span>
                  <Badge tone={selected.status === 'active' ? 'danger' : 'info'}>{selected.status.replace('_',' ').toUpperCase()}</Badge>
                </div>
                <p className="mt-2 text-sm">{selected.type} emergency · {selected.city ?? 'National'}</p>
                <a className="mt-2 flex items-center gap-2 text-xs text-brand-600 hover:underline" href={`https://www.google.com/maps/search/?api=1&query=${selected.lat},${selected.lng}`} target="_blank" rel="noreferrer">
                  <IoLocationOutline /> Open incident coordinates
                </a>
              </div>

              {currentDispatch.isLoading && <Skeleton className="h-20 w-full" />}
              {agencyDispatches.isLoading && <Skeleton className="h-28 w-full" />}

              {selected.status === 'active' && selected.type !== 'medical' && (
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Multi-agency response</p>
                      <p className="text-xs text-muted-foreground">Fire, Police, Rescue and EMS agency routing is independent from the ambulance dispatch.</p>
                    </div>
                    <Button
                      loading={dispatchAgencies.isPending}
                      onClick={() => dispatchAgencies.mutate(selected.id)}
                    >
                      Dispatch required services
                    </Button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {!agencyDispatches.isLoading && (agencyDispatches.data?.length ?? 0) === 0 && (
                      <p className="text-sm text-muted-foreground">No agency dispatch record yet.</p>
                    )}
                    {agencyDispatches.data?.map((d) => (
                      <div key={d.dispatch_id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{d.agency_name}</p>
                            <p className="text-xs capitalize text-muted-foreground">{d.agency_type} · {d.distance_km != null ? d.distance_km.toFixed(1) + ' km' : 'distance unknown'}</p>
                          </div>
                          <Badge tone={
                            ['acknowledged','en_route','on_scene','completed'].includes(d.status) ? 'success'
                              : d.status === 'declined' || d.status === 'timed_out' ? 'warning'
                              : d.status === 'cancelled' ? 'neutral'
                              : 'info'
                          }>
                            {d.status.replace('_',' ').toUpperCase()}
                          </Badge>
                        </div>
                        {d.status === 'offered' && (
                          <div className="mt-2 flex items-center justify-between gap-3">
                            <span className="text-[11px] text-muted-foreground">Offer expires {formatDateTime(d.expires_at)}</span>
                            <Button
                              variant="ghost"
                              loading={cancelAgencyDispatch.isPending}
                              onClick={() => cancelAgencyDispatch.mutate({ dispatchId:d.dispatch_id, emergencyId:selected.id })}
                            >
                              Cancel offer
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentDispatch.data && (
                <div className="rounded-2xl border border-brand-200 p-4 dark:border-brand-900">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Ambulance {currentDispatch.data.ambulance_id.slice(0,8)}…</p>
                      <p className="text-xs text-muted-foreground">{currentDispatch.data.status === 'offered' ? 'Awaiting driver acknowledgement' : 'Driver accepted dispatch'}</p>
                    </div>
                    <Badge tone={currentDispatch.data.status === 'accepted' ? 'success' : 'warning'}>{currentDispatch.data.status.toUpperCase()}</Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {currentDispatch.data.status === 'offered' && selected.status === 'active' && (
                      <Button variant="ghost" loading={cancelDispatch.isPending} onClick={() => cancelDispatch.mutate({ dispatchId: currentDispatch.data!.id, emergencyId: selected.id })}>
                        <IoCloseCircleOutline className="mr-2" /> Cancel offer
                      </Button>
                    )}
                  </div>
                  <div className="mt-3"><LiveLocation ambulanceId={selected.assigned_ambulance_id} /></div>
                </div>
              )}

              {!currentDispatch.data && selected.status === 'active' && (
                <div className="rounded-2xl border border-slate-200 p-4 dark:border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">Nearest responders</p>
                    <Button variant="ghost" onClick={() => void candidates.refetch()}><IoRefreshOutline /></Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {candidates.isLoading && <Skeleton className="h-16 w-full" />}
                    {!candidates.isLoading && candidates.data?.length === 0 && <p className="text-sm text-muted-foreground">No available ambulance is currently visible in the dispatch region.</p>}
                    {candidates.data?.slice(0,5).map((c) => (
                      <div key={c.ambulance_id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                        <div className="flex items-center justify-between gap-3">
                          <div><p className="text-sm font-semibold">{c.vehicle_no}</p><p className="text-xs text-muted-foreground">{c.hospital_name ?? 'Independent unit'} · {c.ambulance_type}</p></div>
                          <span className="text-sm font-bold">{c.distance_km != null ? `${c.distance_km.toFixed(1)} km` : 'GPS unknown'}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground">Last DB location {formatDateTime(c.location_updated_at)}</p>
                      </div>
                    ))}
                  </div>
                  <Button className="mt-4 w-full" loading={dispatchNearest.isPending && dispatchNearest.variables === selected.id} onClick={() => dispatchNearest.mutate(selected.id)}>
                    <IoNavigateOutline className="mr-2" /> Offer nearest available ambulance
                  </Button>
                </div>
              )}

              {selected.status === 'arrived' && (
                <Button className="w-full" loading={statusAction.isPending} onClick={() => statusAction.mutate({ emergencyId: selected.id, status: 'resolved' })}>
                  <IoCheckmarkCircleOutline className="mr-2" /> Mark emergency resolved
                </Button>
              )}

              {(() => {
                const required = selected.type === 'fire' ? ['fire','ems'] : selected.type === 'police' ? ['police','ems'] : [];
                const latest = new Map<string, string>();
                for (const row of agencyDispatches.data ?? []) latest.set(row.agency_type, row.status);
                const ready = selected.status === 'active'
                  && !selected.assigned_ambulance_id
                  && required.length > 0
                  && required.every((type) => latest.get(type) === 'completed');
                return ready ? (
                  <Button
                    className="w-full"
                    loading={resolveNonAmbulance.isPending}
                    onClick={() => resolveNonAmbulance.mutate(selected.id)}
                  >
                    <IoCheckmarkCircleOutline className="mr-2" /> Resolve agency incident
                  </Button>
                ) : null;
              })()}

              {['dispatched','on_scene','transporting'].includes(selected.status) && (
                <LiveLocation ambulanceId={selected.assigned_ambulance_id} />
              )}
            </div>
          )}
        </Card>
      </div>
    </PageTransition>
  );
}
