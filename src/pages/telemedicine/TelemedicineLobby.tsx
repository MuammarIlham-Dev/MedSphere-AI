import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Video, Clock, CalendarDays, ShieldCheck } from 'lucide-react';
import { PageHeader, EmptyState, Skeleton } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useVideoAppointments } from '@/hooks/queries/useTelemedicineQueries';
import { useAuthStore } from '@/stores/authStore';
import { formatTime } from '@/lib/utils';
import type { Appointment } from '@/types';

function joinWindow(appointment: Appointment) {
  const now = Date.now();
  const start = new Date(appointment.scheduled_at).getTime();
  const end = start + appointment.duration_min * 60_000;
  return now >= start - 15 * 60_000 && now <= end + 60 * 60_000;
}

export default function TelemedicineLobby() {
  const navigate = useNavigate();
  const role = useAuthStore((s) => s.profile?.role);
  const { data, isLoading, isError } = useVideoAppointments();
  const appointments = useMemo(() => (data ?? []).filter((a) => ['confirmed', 'checked_in', 'in_progress'].includes(a.status)), [data]);
  return (
    <PageTransition><div className='mx-auto max-w-5xl'>
      <PageHeader title='Telemedicine' subtitle='Secure appointment-linked video consultations. Room access is limited to the patient and assigned doctor.' />
      <div className='mb-6 rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-900/40 dark:bg-brand-950/30 dark:text-brand-200'><div className='flex items-start gap-3'><ShieldCheck className='mt-0.5 h-5 w-5 shrink-0' /><p>The consultation room opens 15 minutes before the scheduled time and remains available for up to 60 minutes after the scheduled end.</p></div></div>
      {isLoading && <div className='space-y-4'>{[1,2,3].map((n) => <Skeleton key={n} className='h-32 w-full rounded-2xl' />)}</div>}
      {isError && <EmptyState title='Telemedicine appointments unavailable' hint='The appointment roster could not be loaded.' />}
      {!isLoading && !isError && appointments.length === 0 && <EmptyState title='No active video consultations' hint={role === 'doctor' ? 'Confirmed video appointments will appear here.' : 'Book a video consultation to see it here.'} />}
      <div className='space-y-4'>{appointments.map((appointment) => {
        const open = joinWindow(appointment);
        const patientName = appointment.patient_name ?? 'Patient';
        const doctorName = appointment.doctor_name ?? 'Assigned doctor';
        const title = role === 'doctor' ? patientName : 'Dr. ' + doctorName;
        return <Card key={appointment.id} className='flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between'>
          <div className='flex min-w-0 items-start gap-3'><div className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'><Video className='h-5 w-5' /></div>
            <div className='min-w-0'><p className='font-semibold text-slate-900 dark:text-white'>{title}</p><p className='mt-1 text-sm text-brand-600 dark:text-brand-400'>{appointment.specialty ?? 'Clinical consultation'}</p>
              <div className='mt-2 flex flex-wrap gap-3 text-xs text-slate-500'><span className='inline-flex items-center gap-1'><CalendarDays className='h-3.5 w-3.5' />{new Date(appointment.scheduled_at).toLocaleDateString('en-US',{timeZone:'Asia/Dhaka',month:'short',day:'numeric'})}</span><span className='inline-flex items-center gap-1'><Clock className='h-3.5 w-3.5' />{formatTime(appointment.scheduled_at)}</span><Badge tone='info'>{appointment.status.replace('_',' ')}</Badge></div>
            </div></div>
          <Button size='sm' disabled={!open} onClick={() => navigate('/app/consult/' + appointment.id)}><Video className='h-4 w-4' />{open ? 'Enter secure room' : 'Room not open'}</Button>
        </Card>;
      })}</div>
    </div></PageTransition>
  );
}