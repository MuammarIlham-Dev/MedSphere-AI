import { useEffect } from 'react';
import { PageTransition } from '@/components/transitions/PageTransition';
import { PageHeader, EmptyState } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IoAlertCircleOutline, IoCheckmarkCircleOutline, IoCloseCircleOutline, IoNavigateOutline, IoLocationOutline } from 'react-icons/io5';
import {
  useMyEmergencyAgencies,
  useMyEmergencyAgencyDispatches,
  useEmergencyAgencyDispatchAction,
  useEmergencyAgencyStatusAction,
} from '@/hooks/queries/useEmergencyAgencyQueries';
import { useUiStore } from '@/stores/uiStore';
import { formatDateTime } from '@/lib/utils';

function agencyLabel(type: string) {
  return type === 'ems' ? 'EMS' : type.charAt(0).toUpperCase() + type.slice(1);
}

export default function EmergencyAgencyDashboard() {
  const toast = useUiStore((s) => s.toast);
  const agencies = useMyEmergencyAgencies();
  const ids = (agencies.data ?? []).map((agency) => agency.agency_id);
  const dispatches = useMyEmergencyAgencyDispatches(ids);
  const responseAction = useEmergencyAgencyDispatchAction();
  const statusAction = useEmergencyAgencyStatusAction();

  useEffect(() => {
    if (!agencies.isError) return;
    toast('error', 'Unable to load your verified emergency agency membership.');
  }, [agencies.isError, toast]);

  const offered = (dispatches.data ?? []).filter((d) => d.status === 'offered');
  const active = (dispatches.data ?? []).filter((d) => ['acknowledged','en_route','on_scene'].includes(d.status));

  return (
    <PageTransition>
      <PageHeader
        title="Agency Emergency Response"
        subtitle="Receive verified dispatches for your Fire, Police, Rescue, or EMS agency and acknowledge them from a controlled workflow."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {(agencies.data ?? []).map((agency) => (
          <Card key={agency.agency_id}>
            <div className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                <IoAlertCircleOutline className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="font-bold">{agency.agency_name}</p>
                <p className="text-sm text-muted-foreground">{agencyLabel(agency.agency_type)} · {agency.city ?? 'National'}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {agencies.data?.length === 0 && !agencies.isLoading && (
        <Card className="mt-6 p-8">
          <EmptyState title="No verified agency membership" hint="An administrator must verify an agency and assign your responder account before dispatches can be received." />
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="New dispatches" subtitle="Each offer has a short acknowledgement window; expired offers are escalated to the next eligible agency." />
          <div className="space-y-4 p-5">
            {offered.length === 0 && <EmptyState title="No new dispatches" hint="New agency offers will appear here through Ably with database polling as the fallback." />}
            {offered.map((d) => (
              <div key={d.dispatch_id} className="rounded-2xl border border-danger-200 bg-danger-50/60 p-4 dark:border-danger-900 dark:bg-danger-950/30">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone="danger">NEW</Badge>
                      <span className="text-sm font-semibold">SOS-{d.emergency_id.slice(0,6).toUpperCase()}</span>
                    </div>
                    <p className="mt-2 font-bold">{agencyLabel(d.agency_type)} response · {d.emergency_type}</p>
                    <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                      <IoLocationOutline />
                      {d.distance_km != null ? d.distance_km.toFixed(1) + ' km from incident' : 'Distance unavailable'}
                    </p>
                    {d.emergency_address && <p className="mt-1 text-xs text-muted-foreground">{d.emergency_address}</p>}
                  </div>
                  <span className="text-right text-xs text-muted-foreground">
                    Expires<br /><span className="font-semibold text-danger-600">{formatDateTime(d.expires_at)}</span>
                  </span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button loading={responseAction.isPending} onClick={() => responseAction.mutate({ action: 'acknowledge', dispatchId: d.dispatch_id, emergencyId: d.emergency_id })}>
                    <IoCheckmarkCircleOutline className="mr-2" /> Acknowledge
                  </Button>
                  <Button variant="ghost" loading={responseAction.isPending} onClick={() => responseAction.mutate({ action: 'decline', dispatchId: d.dispatch_id, emergencyId: d.emergency_id })}>
                    <IoCloseCircleOutline className="mr-2" /> Decline
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Active agency responses" subtitle="Advance the agency response state only after the field team actually changes state." />
          <div className="space-y-4 p-5">
            {active.length === 0 && <EmptyState title="No active agency response" hint="Accepted agency dispatches will appear here." />}
            {active.map((d) => (
              <div key={d.dispatch_id} className="rounded-2xl border border-brand-200 p-4 dark:border-brand-900">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{agencyLabel(d.agency_type)} · {d.emergency_type}</p>
                    <p className="text-xs text-muted-foreground">SOS-{d.emergency_id.slice(0,6).toUpperCase()} · {formatDateTime(d.requested_at)}</p>
                  </div>
                  <Badge tone={d.status === 'on_scene' ? 'success' : 'info'}>{d.status.replace('_',' ').toUpperCase()}</Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {d.status === 'acknowledged' && (
                    <Button loading={statusAction.isPending} onClick={() => statusAction.mutate({ dispatchId:d.dispatch_id, emergencyId:d.emergency_id, status:'en_route' })}>
                      <IoNavigateOutline className="mr-2" /> En route
                    </Button>
                  )}
                  {d.status === 'en_route' && (
                    <Button loading={statusAction.isPending} onClick={() => statusAction.mutate({ dispatchId:d.dispatch_id, emergencyId:d.emergency_id, status:'on_scene' })}>
                      <IoLocationOutline className="mr-2" /> On scene
                    </Button>
                  )}
                  {d.status === 'on_scene' && (
                    <Button loading={statusAction.isPending} onClick={() => statusAction.mutate({ dispatchId:d.dispatch_id, emergencyId:d.emergency_id, status:'completed' })}>
                      <IoCheckmarkCircleOutline className="mr-2" /> Complete response
                    </Button>
                  )}
                  <a
                    className="inline-flex items-center rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-50 dark:border-white/10 dark:hover:bg-surface-dark-muted"
                    href={'https://www.google.com/maps/search/?api=1&query=' + d.emergency_lat + ',' + d.emergency_lng}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Incident map
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
