import { useMemo, useState } from 'react';
import { PageHeader, KpiCard, EmptyState, Skeleton } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageTransition } from '@/components/transitions/PageTransition';
import { useAuthStore } from '@/stores/authStore';
import { useMyHospital } from '@/hooks/queries/useHospitalQueries';
import { useHospitalAppointmentQueue, useHospitalCheckIn, useHospitalConfirmAppointment, useHospitalNoShow } from '@/hooks/queries/useHospitalClinical';

const statuses = ['all','booked','confirmed','checked_in','in_progress','completed','no_show','cancelled'];
const statusTone = (s: string) => s === 'completed' ? 'success' : (s === 'cancelled' || s === 'no_show') ? 'danger' : (s === 'checked_in' || s === 'in_progress') ? 'brand' : 'info';

export default function ClinicalQueue() {
  const profile = useAuthStore((s) => s.profile);
  const { data: hospital } = useMyHospital(profile?.id);
  const [status,setStatus] = useState('all');
  const [clinicOnly,setClinicOnly] = useState(true);
  const queue = useHospitalAppointmentQueue(hospital?.id, !clinicOnly);
  const confirm = useHospitalConfirmAppointment(hospital?.id);
  const checkIn = useHospitalCheckIn(hospital?.id);
  const noShow = useHospitalNoShow(hospital?.id);

  const items = useMemo(() => status === 'all' ? (queue.data ?? []) : (queue.data ?? []).filter((a) => a.status === status), [queue.data,status]);
  const counts = useMemo(() => {
    const rows = queue.data ?? [];
    return {
      total: rows.length,
      pending: rows.filter((r) => ['booked','confirmed'].includes(r.status)).length,
      checkedIn: rows.filter((r) => r.status === 'checked_in').length,
      active: rows.filter((r) => r.status === 'in_progress').length,
    };
  }, [queue.data]);

  if (!hospital) return <EmptyState title="Hospital profile not found" hint="Complete hospital onboarding first." />;

  return <PageTransition>
    <PageHeader title="Clinical Queue" subtitle={clinicOnly ? hospital.name + ' · today’s in-person appointments' : hospital.name + ' · today’s clinic and telemedicine appointments'} />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard label="Appointments today" value={counts.total} />
      <KpiCard label="Awaiting action" value={counts.pending} />
      <KpiCard label="Checked in" value={counts.checkedIn} />
      <KpiCard label="In consultation" value={counts.active} />
    </div>
    <div className="mt-6 flex flex-wrap gap-2">
      <Button size="sm" variant={clinicOnly ? 'primary' : 'secondary'} onClick={() => setClinicOnly(true)}>Clinic only</Button>
      <Button size="sm" variant={!clinicOnly ? 'primary' : 'secondary'} onClick={() => setClinicOnly(false)}>Clinic + video</Button>
      {statuses.map((s) => <Button key={s} size="sm" variant={status === s ? 'primary' : 'ghost'} onClick={() => setStatus(s)}>{s === 'all' ? 'All' : s.replace('_',' ')}</Button>)}
    </div>
    <Card className="mt-6">
      <CardHeader title="Today’s appointments" subtitle="Hospital controls are limited to confirmation, physical check-in and no-show. Clinical progression remains with the assigned doctor." />
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {queue.isLoading && <div className="p-5"><Skeleton className="h-16 w-full" /></div>}
        {!queue.isLoading && items.length === 0 && <div className="p-5"><EmptyState title="No appointments match this view" /></div>}
        {items.map((a) => {
          const canConfirm = a.status === 'booked';
          const canCheckIn = a.type === 'clinic' && ['booked','confirmed'].includes(a.status);
          const canNoShow = ['confirmed','checked_in'].includes(a.status) && new Date(a.scheduled_at).getTime() <= Date.now();
          return <div key={a.appointment_id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-brand-50 px-2.5 py-1 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">#{a.token_number}</span>
                <p className="font-semibold text-slate-900 dark:text-white">{a.patient_name}</p>
                <Badge tone={statusTone(a.status)}>{a.status.replace('_',' ')}</Badge>
                <Badge tone="neutral">{a.type}</Badge>
              </div>
              <p className="mt-1 text-sm text-slate-500">Dr. {a.doctor_name} · {a.specialty ?? 'General'}</p>
              <p className="mt-1 text-xs text-slate-400">{new Date(a.scheduled_at).toLocaleString()} · {a.reason ?? 'General consultation'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {canConfirm && <Button size="sm" loading={confirm.isPending} onClick={() => confirm.mutate({ appointmentId: a.appointment_id })}>Confirm</Button>}
              {canCheckIn && <Button size="sm" variant="success" loading={checkIn.isPending} onClick={() => checkIn.mutate({ appointmentId: a.appointment_id })}>Check in</Button>}
              {canNoShow && <Button size="sm" variant="danger" loading={noShow.isPending} onClick={() => noShow.mutate({ appointmentId: a.appointment_id })}>No-show</Button>}
            </div>
          </div>;
        })}
      </div>
    </Card>
  </PageTransition>;
}
