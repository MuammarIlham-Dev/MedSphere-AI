import { useMemo } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { EmptyState, Skeleton } from '@/components/ui/KpiCard';
import { useBloodInventory } from '@/hooks/queries/useBloodQueries';
import { useBloodBankHospitalRequests, useFulfillHospitalBloodRequest } from '@/hooks/queries/useHospitalBlood';
import { type BloodGroup, type Urgency } from '@/types';

const urgencyTone = (u: Urgency) => u === 'critical' ? 'danger' : u === 'high' ? 'warning' : 'info';

export function HospitalBloodRequisitions({ bankId }: { bankId: string }) {
  const { data: requests, isLoading: requestsLoading } = useBloodBankHospitalRequests(bankId);
  const { data: inventory } = useBloodInventory(bankId);
  const fulfill = useFulfillHospitalBloodRequest(bankId);

  const available = useMemo(() => {
    const map = new Map<BloodGroup, number>();
    for (const row of inventory ?? []) {
      map.set(row.blood_group, Math.max(0, row.units_available - row.units_reserved));
    }
    return map;
  }, [inventory]);

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Hospital requisitions"
        subtitle="Verified hospital requests requiring blood-bank fulfillment. Patient details are visible only inside this authorized workflow."
      />
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {requestsLoading && <div className="p-5"><Skeleton className="h-16 w-full" /></div>}
        {!requestsLoading && !(requests ?? []).length && (
          <div className="p-5"><EmptyState title="No open hospital requisitions" hint="Hospital blood requests will appear here when they need network fulfillment." /></div>
        )}
        {(requests ?? []).map((r) => {
          const remaining = Math.max(0, r.units - r.units_fulfilled);
          const stock = available.get(r.blood_group) ?? 0;
          const fulfillable = Math.min(remaining, stock);
          return (
            <div key={r.id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">{r.hospital_name}</p>
                  <Badge tone={urgencyTone(r.urgency)}>{r.urgency}</Badge>
                  <Badge tone="neutral">{r.blood_group}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{r.patient_name} · {remaining} unit(s) remaining</p>
                <p className="mt-1 text-xs text-slate-400">{r.city ?? 'Location not specified'}{r.needed_by ? ' · needed by ' + new Date(r.needed_by).toLocaleString() : ''}</p>
                {r.notes && <p className="mt-1 text-xs text-slate-400">{r.notes}</p>}
              </div>
              <Button
                size="sm"
                variant={r.urgency === 'critical' ? 'danger' : 'primary'}
                loading={fulfill.isPending}
                disabled={fulfillable < 1}
                onClick={() => fulfill.mutate({ requestId: r.id, units: fulfillable })}
              >
                {fulfillable > 0 ? 'Fulfill ' + fulfillable + ' unit(s)' : 'Insufficient stock'}
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
