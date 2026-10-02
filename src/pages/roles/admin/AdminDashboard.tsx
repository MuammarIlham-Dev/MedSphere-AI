import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { KpiCard, Skeleton, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { formatDateTime } from '@/lib/utils';
import { IoShieldCheckmarkOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { useAuditLog, usePendingDoctors, useVerifyDoctor } from '@/hooks/queries/useAdminQueries';
import { useUiStore } from '@/stores/uiStore';
import { useRef } from 'react';
import { useReveal } from '@/lib/gsap';

export default function AdminDashboard() {
  const { data: pending, isLoading } = usePendingDoctors();
  const { data: audit } = useAuditLog();
  const verify = useVerifyDoctor();
  const toast = useUiStore((s) => s.toast);
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  return (
    <PageTransition>
      <div ref={rootRef}>
      <PageHeader title="Platform administration" subtitle="Verification, compliance and audit" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Pending doctor verifications" value={pending?.length ?? 0} icon={<IoShieldCheckmarkOutline className="h-5 w-5" />} />
        <KpiCard label="Audit events (24h)" value={audit?.length ?? 0} icon={<IoDocumentTextOutline className="h-5 w-5" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Doctor verification queue" subtitle="License review required before platform access" />
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {isLoading && <li className="p-5"><Skeleton className="h-12 w-full" /></li>}
            {(pending ?? []).map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{d.specialty} · {d.experience_years}y</p>
                  <p className="text-xs text-slate-400">License {d.license_no} · {d.qualifications.join(', ')}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" loading={verify.isPending}
                    onClick={() => verify.mutate({ id: d.id, approve: true }, { onError: (e) => toast('error', e.message) })}>
                    Verify
                  </Button>
                  <Button size="sm" variant="danger" loading={verify.isPending}
                    onClick={() => verify.mutate({ id: d.id, approve: false }, { onError: (e) => toast('error', e.message) })}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
            {!isLoading && (pending ?? []).length === 0 && <li className="p-5"><EmptyState title="Queue is clear" /></li>}
          </ul>
        </Card>

        <Card>
          <CardHeader title="Audit trail" subtitle="Immutable record of sensitive operations" />
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto font-mono text-xs dark:divide-white/5">
            {(audit ?? []).map((a) => (
              <li key={a.id} className="px-5 py-3">
                <span className="text-slate-400">{formatDateTime(a.created_at)}</span>{' '}
                <Badge tone={a.action === 'DELETE' ? 'danger' : a.action === 'UPDATE' ? 'warning' : 'info'}>{a.action}</Badge>{' '}
                <span className="font-semibold">{a.table_name}</span>{' '}
                <span className="text-slate-400">#{a.record_id?.slice(0, 8)}</span>
              </li>
            ))}
            {(audit ?? []).length === 0 && <li className="p-5 font-sans"><EmptyState title="No audit events yet" /></li>}
          </ul>
        </Card>
      </div>
      </div>
    </PageTransition>
  );
}
