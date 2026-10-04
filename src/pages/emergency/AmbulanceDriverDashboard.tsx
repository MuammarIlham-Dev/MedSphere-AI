import { useEffect, useRef, useState } from 'react';
import { PageTransition } from '@/components/transitions/PageTransition';
import { PageHeader, EmptyState } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  IoLocationOutline, IoNavigateOutline, IoCheckmarkCircleOutline,
  IoCloseCircleOutline, IoRadioOutline, IoCarOutline,
} from 'react-icons/io5';
import {
  useDriverDispatchAction,
  useEmergencyStatusAction,
  useMyAmbulance,
  useMyEmergencyDispatches,
} from '@/hooks/queries/useEmergencyQueries';
import { useUiStore } from '@/stores/uiStore';
import { formatDateTime } from '@/lib/utils';
import { emergencyService } from '@/services/emergency.service';

export default function AmbulanceDriverDashboard() {
  const toast = useUiStore((s) => s.toast);
  const { data: ambulance, isLoading: ambulanceLoading } = useMyAmbulance();
  const dispatches = useMyEmergencyDispatches(ambulance?.ambulance_id);
  const dispatchAction = useDriverDispatchAction();
  const statusAction = useEmergencyStatusAction();
  const [tracking, setTracking] = useState(false);
  const watchRef = useRef<number | null>(null);
  const lastSentAtRef = useRef(0);

  const offered = (dispatches.data ?? []).filter((d) => d.dispatch_status === 'offered');
  const active = (dispatches.data ?? []).find((d) => d.dispatch_status === 'accepted');

  useEffect(() => () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
  }, []);

  const stopTracking = () => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    setTracking(false);
  };

  const startTracking = () => {
    if (!ambulance?.ambulance_id || !active) return;
    if (!('geolocation' in navigator)) {
      toast('error', 'Location services are not available on this device.');
      return;
    }

    const startedAt = Date.now();
    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - lastSentAtRef.current < 3_000) return;
        lastSentAtRef.current = Date.now();
        void emergencyService
          .publishAmbulanceLocation(
            ambulance.ambulance_id,
            position.coords.latitude,
            position.coords.longitude,
          )
          .catch(() => {
            // Keep the mission running; the next GPS sample retries automatically.
          });

        if (Date.now() - startedAt > 3_000) setTracking(true);
      },
      () => toast('error', 'Live tracking lost. Check location permission and GPS.'),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 },
    );
    setTracking(true);
  };

  useEffect(() => {
    if (!active) stopTracking();
  }, [active?.dispatch_id]);

  return (
    <PageTransition>
      <PageHeader
        title="Ambulance Response"
        subtitle="Acknowledge dispatches, advance the mission state, and share live GPS with the response network."
      />

      {ambulanceLoading && <Card className="p-6"><p className="text-sm text-muted-foreground">Loading ambulance assignment…</p></Card>}

      {!ambulanceLoading && !ambulance && (
        <Card className="p-8">
          <EmptyState
            title="No ambulance is assigned to this account"
            hint="An administrator or hospital dispatcher must assign an ambulance to your driver account before you can receive missions."
          />
        </Card>
      )}

      {ambulance && (
        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader title="Vehicle" subtitle="Operational identity" />
            <div className="space-y-4 p-5">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <IoCarOutline className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-lg font-bold">{ambulance.vehicle_no}</p>
                  <p className="text-sm text-muted-foreground">{ambulance.ambulance_type} · {ambulance.hospital_name ?? 'Independent unit'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-surface-muted p-3 dark:bg-surface-dark-muted">
                <span className="text-sm text-muted-foreground">Vehicle status</span>
                <Badge tone={ambulance.status === 'busy' ? 'warning' : 'success'}>{ambulance.status.toUpperCase()}</Badge>
              </div>
              <div className="text-xs text-muted-foreground">
                Equipment: {(ambulance.equipment ?? []).length ? ambulance.equipment.join(' · ') : 'Not listed'}
              </div>
              {active && (
                <div className="rounded-2xl border border-brand-200 bg-brand-50/70 p-4 dark:border-brand-900 dark:bg-brand-950/40">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">Live mission tracking</p>
                      <p className="text-xs text-muted-foreground">GPS samples are sent over a scoped Ably channel.</p>
                    </div>
                    <Button
                      variant={tracking ? 'danger' : 'primary'}
                      onClick={tracking ? stopTracking : startTracking}
                    >
                      <IoRadioOutline className="mr-2" />
                      {tracking ? 'Stop sharing' : 'Start live GPS'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Dispatch queue" subtitle="Only missions assigned to your driver account are shown." />
            <div className="space-y-4 p-5">
              {!dispatches.isLoading && offered.length === 0 && !active && (
                <EmptyState title="No active dispatch" hint="New offers will appear here in real time and via the fallback sync." />
              )}

              {offered.map((d) => (
                <div key={d.dispatch_id} className="rounded-2xl border border-danger-200 bg-danger-50/60 p-4 dark:border-danger-900 dark:bg-danger-950/30">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="danger">NEW DISPATCH</Badge>
                        <span className="text-sm font-semibold">SOS-{d.emergency_id.slice(0, 6).toUpperCase()}</span>
                      </div>
                      <p className="mt-2 text-base font-bold capitalize">{d.emergency_type} emergency</p>
                      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <IoLocationOutline />
                        {d.distance_km != null ? `${d.distance_km.toFixed(1)} km away` : 'Distance unavailable'}
                      </p>
                      {d.emergency_address && <p className="mt-1 text-sm">{d.emergency_address}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        loading={dispatchAction.isPending}
                        onClick={() => dispatchAction.mutate({ action: 'accept', dispatchId: d.dispatch_id })}
                      >
                        <IoCheckmarkCircleOutline className="mr-2" /> Accept
                      </Button>
                      <Button
                        variant="ghost"
                        loading={dispatchAction.isPending}
                        onClick={() => dispatchAction.mutate({ action: 'decline', dispatchId: d.dispatch_id })}
                      >
                        <IoCloseCircleOutline className="mr-2" /> Decline
                      </Button>
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Offered {formatDateTime(d.offered_at)} · Destination hospital: {d.hospital_name ?? 'Not assigned yet'}</p>
                </div>
              ))}

              {active && (
                <div className="rounded-2xl border border-brand-200 p-4 dark:border-brand-900">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="info">ACCEPTED</Badge>
                        <span className="text-sm font-semibold">SOS-{active.emergency_id.slice(0, 6).toUpperCase()}</span>
                      </div>
                      <p className="mt-2 font-bold capitalize">{active.emergency_type} · {active.emergency_status.replace('_', ' ')}</p>
                      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <IoNavigateOutline />
                        {active.distance_km != null ? `${active.distance_km.toFixed(1)} km from pickup` : 'Pickup distance unavailable'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {active.emergency_status === 'dispatched' && (
                        <Button loading={statusAction.isPending} onClick={() => statusAction.mutate({ emergencyId: active.emergency_id, status: 'on_scene' })}>On scene</Button>
                      )}
                      {active.emergency_status === 'on_scene' && (
                        <Button loading={statusAction.isPending} onClick={() => statusAction.mutate({ emergencyId: active.emergency_id, status: 'transporting' })}>Start transport</Button>
                      )}
                      {active.emergency_status === 'transporting' && (
                        <Button loading={statusAction.isPending} onClick={() => statusAction.mutate({ emergencyId: active.emergency_id, status: 'arrived' })}>Arrived</Button>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <a
                      className="rounded-xl border border-slate-200 p-3 text-sm hover:bg-slate-50 dark:border-white/10 dark:hover:bg-surface-dark-muted"
                      href={`https://www.google.com/maps/search/?api=1&query=${active.emergency_lat},${active.emergency_lng}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <span className="font-semibold">Open pickup location</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{active.emergency_lat.toFixed(5)}, {active.emergency_lng.toFixed(5)}</span>
                    </a>
                    <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
                      <span className="font-semibold">Hospital destination</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{active.hospital_name ?? 'Assigned during response'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </PageTransition>
  );
}
