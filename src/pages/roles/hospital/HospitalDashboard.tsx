import { useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, KpiCard, EmptyState } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageTransition } from '@/components/transitions/PageTransition';
import { useAuthStore } from '@/stores/authStore';
import { useMyHospital } from '@/hooks/queries/useHospitalQueries';
import { useHospitalAdmissions, useHospitalBedRequests, useHospitalBeds } from '@/hooks/queries/useBedQueries';
import { useReveal } from '@/lib/gsap';

export default function HospitalDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const { data: hospital } = useMyHospital(profile?.id);
  const beds = useHospitalBeds(hospital?.id);
  const requests = useHospitalBedRequests(hospital?.id);
  const admissions = useHospitalAdmissions(hospital?.id);
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  const inventory = beds.data ?? [];
  const activeAdmissions = (admissions.data ?? []).filter((a: any) => a.status === 'admitted');
  const pendingRequests = (requests.data ?? []).filter((r: any) => ['requested', 'reviewing'].includes(r.status));
  const operationalBeds = inventory.filter((b: any) => b.status !== 'blocked');
  const availableBeds = inventory.filter((b: any) => b.status === 'available');
  const occupiedBeds = inventory.filter((b: any) => b.status === 'occupied');
  const reservedBeds = inventory.filter((b: any) => b.status === 'reserved');
  const icuBeds = inventory.filter((b: any) => b.category === 'icu' && b.status !== 'blocked');
  const icuAvailable = icuBeds.filter((b: any) => b.status === 'available');

  const occupancy = operationalBeds.length ? Math.round(((occupiedBeds.length + reservedBeds.length) / operationalBeds.length) * 100) : 0;

  const bedSummary = useMemo(() => [
    ['Available', availableBeds.length, 'success'],
    ['Reserved', reservedBeds.length, 'warning'],
    ['Occupied', occupiedBeds.length, 'info'],
    ['Maintenance/other', Math.max(operationalBeds.length - availableBeds.length - reservedBeds.length - occupiedBeds.length, 0), 'neutral'],
  ] as const, [availableBeds.length, reservedBeds.length, occupiedBeds.length, operationalBeds.length]);

  if (!hospital) return <EmptyState title="Hospital profile not found" hint="Complete hospital onboarding to manage operations." />;

  return (
    <PageTransition>
      <div ref={rootRef}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <PageHeader title={hospital.name} subtitle={(hospital.city ?? '') + ' · ' + hospital.type} />
          <div className="flex flex-wrap gap-2">
            <Link to="/app/hospital/inpatient"><Button>Open Inpatient Operations</Button></Link>
            <Link to="/app/hospital/beds"><Button variant="secondary">Manage Beds</Button></Link>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Operational beds" value={operationalBeds.length} />
          <KpiCard label="Available beds" value={availableBeds.length} />
          <KpiCard label="Active admissions" value={activeAdmissions.length} />
          <KpiCard label="Pending requests" value={pendingRequests.length} />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Live capacity" subtitle="Derived from hospital bed inventory; manual capacity overrides are blocked." />
            <div className="p-5">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold text-slate-900 dark:text-white">{occupancy}%</p>
                  <p className="text-sm text-slate-500">occupied or reserved</p>
                </div>
                <p className="text-sm text-slate-500">{availableBeds.length} beds free · {icuAvailable.length} ICU free</p>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-surface-dark-muted">
                <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: occupancy + '%' }} />
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {bedSummary.map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-surface-muted p-3 dark:bg-surface-dark-muted">
                    <p className="text-lg font-semibold text-slate-900 dark:text-white">{value}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-slate-400">ICU: {icuAvailable.length}/{icuBeds.length} available.</p>
            </div>
          </Card>

          <Card>
            <CardHeader title="Pending bed requests" subtitle="Independent of doctor appointment booking." />
            <div>
              {pendingRequests.slice(0, 6).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-3 border-b border-slate-100 p-4 last:border-b-0 dark:border-white/5">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900 dark:text-white">{r.patient_name_snapshot}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{r.category} · {r.reason}</p>
                  </div>
                  <Badge tone={r.is_emergency ? 'danger' : 'info'}>{r.status}</Badge>
                </div>
              ))}
              {pendingRequests.length === 0 && <EmptyState title="No pending requests" />}
            </div>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader title="Current inpatient stays" subtitle="Operational view of admitted patients." action={
            <Link to="/app/hospital/inpatient"><Button size="sm" variant="ghost">View all</Button></Link>
          } />
          <div>
            {activeAdmissions.slice(0, 8).map((a: any) => (
              <div key={a.id} className="flex flex-col gap-2 border-b border-slate-100 p-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between dark:border-white/5">
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">{a.patient_name_snapshot}</p>
                  <p className="text-xs text-slate-500">{a.admission_reason}</p>
                </div>
                <Badge tone={a.doctor_id ? 'success' : 'warning'}>{a.doctor_id ? 'Clinician assigned' : 'Needs clinician'}</Badge>
              </div>
            ))}
            {activeAdmissions.length === 0 && <EmptyState title="No active admissions" />}
          </div>
        </Card>
      </div>
    </PageTransition>
  );
}
