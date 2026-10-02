import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { KpiCard, Skeleton, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { formatTime } from '@/lib/utils';
import { ChartCard } from '@/components/charts/ChartCard';
import { Link } from 'react-router-dom';
import { IoPeopleOutline, IoCheckmarkDoneOutline, IoTimeOutline, IoStarOutline } from 'react-icons/io5';
import { useTodayQueue, useUpdateAppointmentStatus } from '@/hooks/queries/useAppointmentQueries';
import { useAuthStore } from '@/stores/authStore';
import { useMyDoctor } from '@/hooks/queries/useDoctorQueries';
import { useUiStore } from '@/stores/uiStore';
import type { AppointmentStatus } from '@/types';
import { useRef } from 'react';
import { useReveal } from '@/lib/gsap';

const NEXT: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  booked: 'confirmed', confirmed: 'checked_in', checked_in: 'in_progress', in_progress: 'completed',
};

export default function DoctorDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const toast = useUiStore((s) => s.toast);
  const { data: doctor } = useMyDoctor(profile?.id);
  const queue = useTodayQueue(doctor?.id);
  const setStatus = useUpdateAppointmentStatus();
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  const items = queue.data ?? [];
  const current = items.find((a) => a.status === 'in_progress') ?? items.find((a) => a.status === 'checked_in');
  const done = items.filter((a) => a.status === 'completed').length;

  return (
    <PageTransition>
      <div ref={rootRef}>
      <PageHeader title="Today's practice" subtitle={doctor ? `${doctor.specialty} · ${items.length} patients scheduled` : 'Loading…'} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Patients today" value={items.length} icon={<IoPeopleOutline className="h-5 w-5" />} />
        <KpiCard label="Completed" value={done} icon={<IoCheckmarkDoneOutline className="h-5 w-5" />} />
        <KpiCard label="Current token" value={current ? `#${current.token_number}` : '—'} icon={<IoTimeOutline className="h-5 w-5" />} />
        <KpiCard label="Rating" value={doctor ? `${doctor.rating_avg} (${doctor.rating_count})` : '—'} icon={<IoStarOutline className="h-5 w-5" />} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Live queue" subtitle="Advance patients through the consultation flow" />
        <ul className="divide-y divide-slate-100 dark:divide-white/5">
          {queue.isLoading && <li className="p-5"><Skeleton className="h-12 w-full" /></li>}
          {items.length === 0 && !queue.isLoading && <li className="p-5"><EmptyState title="No patients scheduled today" /></li>}
          {items.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div className="flex items-center gap-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-sm font-bold text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {a.token_number}
                </span>
                <div>
                  <p className="text-sm font-medium">{a.patient_name}</p>
                  <p className="text-xs text-slate-400">{formatTime(a.scheduled_at)} · {a.type} · {a.reason ?? 'General consultation'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={a.status === 'completed' ? 'success' : a.status === 'cancelled' ? 'danger' : 'brand'}>{a.status.replace('_', ' ')}</Badge>
                {NEXT[a.status] && (
                  <Button size="sm" onClick={() => setStatus.mutate({ id: a.id, status: NEXT[a.status]! },
                    { onError: (e) => toast('error', e.message) })}>
                    {NEXT[a.status] === 'completed' ? 'Complete' : 'Advance'}
                  </Button>
                )}
                {a.type === 'video' && a.status !== 'completed' && (
                  <Link to={`/app/consult/${a.id}`}><Button size="sm" variant="secondary">Join video</Button></Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Weekly utilization" config={{
          type: 'bar',
          data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            datasets: [{ label: 'Consultations', data: [8, 11, 9, 12, 10, items.length], backgroundColor: '#0891b2', borderRadius: 8 }],
          },
        }} />
        <ChartCard title="Consultation mix" config={{
          type: 'doughnut',
          data: {
            labels: ['Video', 'Clinic'],
            datasets: [{ data: [items.filter((a) => a.type === 'video').length || 1, items.filter((a) => a.type === 'clinic').length || 1], backgroundColor: ['#0891b2', '#67e8f9'] }],
          },
        }} />
      </div>
      </div>
    </PageTransition>
  );
}
