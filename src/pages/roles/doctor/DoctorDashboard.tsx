/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-confusing-void-expression, @typescript-eslint/no-non-null-assertion */
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { KpiCard, Skeleton, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { FullPageLoader } from '@/components/ui/Spinner';
import { PageTransition } from '@/components/transitions/PageTransition';
import { formatTime } from '@/lib/utils';

import { Link } from 'react-router-dom';
import { IoPeopleOutline, IoCheckmarkDoneOutline, IoTimeOutline, IoStarOutline } from 'react-icons/io5';
import { useTodayQueue, useUpdateAppointmentStatus } from '@/hooks/queries/useAppointmentQueries';
import { useAuthStore } from '@/stores/authStore';
import { useMyDoctor } from '@/hooks/queries/useDoctorQueries';
import { useUiStore } from '@/stores/uiStore';
import type { AppointmentStatus } from '@/types';
import { useRef } from 'react';
import { useReveal } from '@/lib/gsap';
import { ScheduleSettings } from '@/components/doctor/ScheduleSettings';
import { DoctorProfileSettings } from '@/components/doctor/DoctorProfileSettings';
import { DoctorAnalytics } from '@/components/doctor/DoctorAnalytics';
import { DoctorOnboarding } from './DoctorOnboarding';

const NEXT: Partial<Record<AppointmentStatus, AppointmentStatus>> = {
  booked: 'confirmed', confirmed: 'checked_in', checked_in: 'in_progress', in_progress: 'completed',
};

export default function DoctorDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const toast = useUiStore((s) => s.toast);
  const { data: doctor, isLoading: isDoctorLoading } = useMyDoctor(profile?.id);
  const queue = useTodayQueue(doctor?.id);
  const setStatus = useUpdateAppointmentStatus();
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  const items = queue.data ?? [];
  const current = items.find((a) => a.status === 'in_progress') ?? items.find((a) => a.status === 'checked_in');
  const done = items.filter((a) => a.status === 'completed').length;
  const activeCount = items.filter((a) => !['cancelled', 'no_show'].includes(a.status)).length;

  if (isDoctorLoading) {
    return <FullPageLoader />;
  }

  if (doctor === null) {
    if (!profile) return null;
    return (
      <PageTransition>
        <DoctorOnboarding profileId={profile.id} />
      </PageTransition>
    );
  }

  if (doctor?.verification === 'pending') {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl pt-8 pb-12">
          <PageHeader title="Application under review" subtitle="Your doctor application is currently being reviewed by our administrators." />
          <Card className="mt-6 p-6">
            <EmptyState title="Verification Pending" hint="We will notify you once your application has been approved." />
          </Card>
        </div>
      </PageTransition>
    );
  }

  if (doctor?.verification === 'rejected' || doctor?.verification === 'suspended') {
    return (
      <PageTransition>
        <div className="mx-auto max-w-2xl pt-8 pb-12">
          <PageHeader title="Access restricted" subtitle={`Your account has been ${doctor.verification}.`} />
          <Card className="mt-6 p-6">
            <EmptyState title="Access Restricted" hint="Please contact support for more information." />
          </Card>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div ref={rootRef}>
      <PageHeader title="Today's practice" subtitle={doctor ? `${doctor.specialty} · ${activeCount} patients scheduled` : 'Loading…'} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Patients today" value={activeCount} icon={<IoPeopleOutline className="h-5 w-5" />} />
        <KpiCard label="Completed" value={done} icon={<IoCheckmarkDoneOutline className="h-5 w-5" />} />
        <KpiCard label="Current token" value={current ? `#${current.token_number}` : '—'} icon={<IoTimeOutline className="h-5 w-5" />} />
        <KpiCard label="Rating" value={doctor ? `${String(doctor.rating_avg)} (${String(doctor.rating_count)})` : '—'} icon={<IoStarOutline className="h-5 w-5" />} />
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

      {doctor?.id && (
        <DoctorAnalytics doctorId={doctor.id} />
      )}

      {doctor?.id && (
        <>
          <DoctorProfileSettings doctor={doctor} />
          <ScheduleSettings doctorId={doctor.id} />
        </>
      )}
      
      </div>
    </PageTransition>
  );
}
