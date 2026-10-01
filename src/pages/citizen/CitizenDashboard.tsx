import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { KpiCard, Skeleton, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { formatDateTime } from '@/lib/utils';
import { ChartCard } from '@/components/charts/ChartCard';
import { IoCalendarOutline, IoWaterOutline, IoMedkitOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { Link } from 'react-router-dom';
import { useMyAppointments } from '@/hooks/useAppointments';
import { useAuthStore } from '@/stores/authStore';
import { useRef } from 'react';
import { useReveal } from '@/lib/gsap';
import { AiSymptomChecker } from '@/components/intelligence/AiSymptomChecker';
export default function CitizenDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const { data: appointments, isLoading } = useMyAppointments();
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  const upcoming = (appointments ?? []).filter((a) => new Date(a.scheduled_at) > new Date() && a.status !== 'cancelled');

  return (
    <PageTransition>
      <div ref={rootRef}>
        <PageHeader title={`Hello, ${profile?.full_name.split(' ')[0] ?? 'there'}`}
          subtitle={`Digital Health ID: ${profile?.digital_health_id ?? '—'}`}
          actions={<Link to="/app/emergency"><Button variant="danger">Emergency SOS</Button></Link>} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Upcoming appointments" value={upcoming.length} icon={<IoCalendarOutline className="h-5 w-5" />} />
          <KpiCard label="Blood group" value={profile?.blood_group ?? 'Not set'} icon={<IoWaterOutline className="h-5 w-5" />} />
          <KpiCard label="Active prescriptions" value="—" icon={<IoMedkitOutline className="h-5 w-5" />} />
          <KpiCard label="Health documents" value="—" icon={<IoDocumentTextOutline className="h-5 w-5" />} />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-3">
          <Card className="neon-card lg:col-span-2" data-reveal>
            <CardHeader title="Upcoming appointments" subtitle="Your next consultations"
              action={<Link to="/app/appointments"><Button size="sm" variant="secondary">Book new</Button></Link>} />
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {isLoading && [0, 1, 2].map((i) => <li key={i} className="p-5"><Skeleton className="h-10 w-full" /></li>)}
              {!isLoading && upcoming.length === 0 && (
                <li className="p-5"><EmptyState title="No upcoming appointments" hint="Find a doctor and book your first consultation." /></li>
              )}
              {upcoming.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{a.doctor_name ?? 'Doctor'} · <span className="text-slate-400">{a.specialty}</span></p>
                    <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(a.scheduled_at)} · Token #{a.token_number}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={a.type === 'video' ? 'info' : 'brand'}>{a.type}</Badge>
                    {a.type === 'video' && <Link to={`/app/consult/${a.id}`}><Button size="sm" variant="secondary">Join</Button></Link>}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <ChartCard title="Health timeline" subtitle="Appointments per month" config={{
            type: 'line',
            data: {
              labels: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
              datasets: [{
                label: 'Visits', data: [1, 2, 1, 3, 2, upcoming.length],
                borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,0.12)', fill: true, tension: 0.4,
              }],
            },
          }} />

          <div className="lg:col-span-3">
            <AiSymptomChecker />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
