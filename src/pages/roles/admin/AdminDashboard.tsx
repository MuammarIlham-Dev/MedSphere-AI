import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { KpiCard, Skeleton, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { formatDateTime } from '@/lib/utils';
import { IoShieldCheckmarkOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { useAuditLog, usePendingDoctors, usePendingDoctorCredentials, useReviewDoctorCredential, useVerifyDoctor, usePendingRoleRequests, useResolveRoleRequest } from '@/hooks/queries/useAdminQueries';
import { useUiStore } from '@/stores/uiStore';
import { useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useReveal } from '@/lib/gsap';

export default function AdminDashboard() {
  const { data: pending, isLoading } = usePendingDoctors();
  const { data: roleRequests } = usePendingRoleRequests();
  const { data: pendingCredentials } = usePendingDoctorCredentials();
  const { data: audit } = useAuditLog();
  const verify = useVerifyDoctor();
  const reviewCredential = useReviewDoctorCredential();
  const resolveRoleRequest = useResolveRoleRequest();
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
          <CardHeader title="Professional role requests" subtitle="Signup requests are non-authoritative until an administrator provisions the role" />
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {(roleRequests ?? []).map((request) => (
              <li key={request.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium">{request.full_name} · {request.requested_role.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-400">{request.phone ?? 'No phone'} · Requested {formatDateTime(request.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" loading={resolveRoleRequest.isPending}
                    onClick={() => resolveRoleRequest.mutate({ profileId: request.id, approve: true })}>
                    Provision
                  </Button>
                  <Button size="sm" variant="danger" loading={resolveRoleRequest.isPending}
                    onClick={() => resolveRoleRequest.mutate({ profileId: request.id, approve: false })}>
                    Reject
                  </Button>
                </div>
              </li>
            ))}
            {(roleRequests ?? []).length === 0 && <li className="p-5"><EmptyState title="No pending role requests" /></li>}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Credential evidence queue" subtitle="Review uploaded professional evidence before verification decisions" />
          <ul className="divide-y divide-slate-100 dark:divide-white/5">
            {(pendingCredentials ?? []).map((c: any) => (
              <li key={c.id} className="space-y-3 px-5 py-4">
                <div>
                  <p className="text-sm font-medium">{c.doctors?.profiles?.full_name ?? 'Doctor'} · {c.credential_type.replace('_', ' ')}</p>
                  <p className="text-xs text-slate-400">License {c.doctors?.license_no ?? '—'} · {c.document_number ? 'Document '+c.document_number+' · ' : ''}Submitted {formatDateTime(c.created_at)}</p>
                  {c.expires_at && <p className="text-xs text-slate-400">Expires {c.expires_at}</p>}
                  {c.file?.path && <Button size="sm" variant="secondary" onClick={async () => { const result = await supabase.storage.from(c.file.bucket).createSignedUrl(c.file.path, 300); if (result.error) toast('error', 'Could not open credential evidence'); else window.open(result.data.signedUrl, '_blank', 'noopener,noreferrer'); }}>View evidence</Button>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="success" loading={reviewCredential.isPending} onClick={() => reviewCredential.mutate({ id: c.id, status: 'accepted' }, { onError: (e) => toast('error', e.message) })}>Accept evidence</Button>
                  <Button size="sm" variant="danger" loading={reviewCredential.isPending} onClick={() => reviewCredential.mutate({ id: c.id, status: 'rejected', notes: 'Evidence was not accepted. Please submit clearer or corrected documentation.' }, { onError: (e) => toast('error', e.message) })}>Reject evidence</Button>
                </div>
              </li>
            ))}
            {(pendingCredentials ?? []).length === 0 && <li className="p-5"><EmptyState title="No credential reviews pending" /></li>}
          </ul>
        </Card>

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
