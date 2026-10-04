import { useMemo, useState } from 'react';
import { PageTransition } from '@/components/transitions/PageTransition';
import { PageHeader, KpiCard, EmptyState, Skeleton } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useMyHospital } from '@/hooks/queries/useHospitalQueries';
import { useHospitalLaboratoryOrders } from '@/hooks/queries/useHospitalLaboratory';
import { useAuthStore } from '@/stores/authStore';
import { formatDateTime } from '@/lib/utils';

const orderTone = (status: string) => {
  if (status === 'delivered' || status === 'verified') return 'success' as const;
  if (status === 'completed') return 'info' as const;
  if (status === 'in_progress') return 'brand' as const;
  return 'warning' as const;
};

export default function HospitalLaboratory() {
  const profile = useAuthStore((s) => s.profile);
  const { data: hospital } = useMyHospital(profile?.id);
  const { data: rows, isLoading } = useHospitalLaboratoryOrders(hospital?.id);
  const [status, setStatus] = useState('all');

  const orders = useMemo(() => {
    const map = new Map<string, {
      id: string;
      patient_name: string;
      doctor_name: string | null;
      lab_name: string;
      priority: string;
      order_status: string;
      booked_at: string;
      tests: NonNullable<typeof rows>;
    }>();
    for (const row of rows ?? []) {
      const existing = map.get(row.order_id);
      if (existing) {
        existing.tests.push(row);
      } else {
        map.set(row.order_id, {
          id: row.order_id,
          patient_name: row.patient_name,
          doctor_name: row.doctor_name,
          lab_name: row.lab_name,
          priority: row.priority,
          order_status: row.order_status,
          booked_at: row.booked_at,
          tests: [row],
        });
      }
    }
    const grouped = Array.from(map.values());
    return status === 'all' ? grouped : grouped.filter((order) => order.order_status === status);
  }, [rows, status]);

  const counts = useMemo(() => {
    const unique = new Map<string, string>();
    for (const row of rows ?? []) unique.set(row.order_id, row.order_status);
    const values = Array.from(unique.values());
    return {
      orders: values.length,
      active: values.filter((s) => ['pending', 'in_progress'].includes(s)).length,
      ready: values.filter((s) => ['completed', 'verified'].includes(s)).length,
      published: values.filter((s) => s === 'delivered').length,
    };
  }, [rows]);

  if (!hospital) return <EmptyState title="Hospital profile not found" hint="Complete hospital onboarding first." />;

  return (
    <PageTransition>
      <PageHeader
        title="Hospital Laboratory"
        subtitle={hospital.name + ' · diagnostic order coordination without exposing report results'}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Diagnostic orders" value={counts.orders} />
        <KpiCard label="Active processing" value={counts.active} />
        <KpiCard label="Reports ready" value={counts.ready} />
        <KpiCard label="Published" value={counts.published} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {['all', 'pending', 'in_progress', 'completed', 'verified', 'delivered'].map((value) => (
          <Button key={value} size="sm" variant={status === value ? 'primary' : 'ghost'} onClick={() => setStatus(value)}>
            {value === 'all' ? 'All' : value.replace('_', ' ')}
          </Button>
        ))}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Diagnostic coordination"
          subtitle="Shows patient/test identity and workflow state only. Clinical result values remain in the protected EHR boundary."
        />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {isLoading && <div className="p-5"><Skeleton className="h-20 w-full" /></div>}
          {!isLoading && orders.length === 0 && (
            <div className="p-10">
              <EmptyState title="No diagnostic orders in this view" hint="Doctor-created laboratory orders attached to this hospital will appear here." />
            </div>
          )}

          {orders.map((order) => (
            <div key={order.id} className="p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900 dark:text-white">{order.patient_name}</p>
                    <Badge tone={orderTone(order.order_status)}>{order.order_status.replace('_', ' ')}</Badge>
                    <Badge tone="neutral">{order.priority}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {order.lab_name} · {order.doctor_name ? 'Dr. ' + order.doctor_name : 'Doctor unavailable'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">Ordered {formatDateTime(order.booked_at)}</p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2">
                {order.tests.map((test) => (
                  <div key={test.order_id + ':' + test.test_id} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{test.test_name}</span>
                      <span className="text-xs text-slate-400">{test.test_code}</span>
                      <Badge tone={test.sample_status === 'analyzed' ? 'success' : test.sample_status === 'processing' ? 'brand' : 'info'}>
                        {test.sample_status.replace('_', ' ')}
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {test.report_status ? 'Report: ' + test.report_status : 'Report: not yet prepared'}
                      {test.report_code ? ' · ' + test.report_code : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </PageTransition>
  );
}
