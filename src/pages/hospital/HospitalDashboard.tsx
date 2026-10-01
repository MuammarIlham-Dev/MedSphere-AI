import { KpiCard, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { ChartCard } from '@/components/charts/ChartCard';
import { useAuthStore } from '@/stores/authStore';
import { useQuery } from '@tanstack/react-query';
import { IoBedOutline, IoBusinessOutline, IoMedkitOutline, IoCarOutline } from 'react-icons/io5';

export default function HospitalDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const { data: hospital } = useQuery({
    queryKey: ['my-hospital', profile?.id],
    queryFn: () => {
      if (!profile) return Promise.resolve(null);
      return unwrap<{ name: string; city: string | null; type: string; beds_available: number; bed_capacity: number; icu_available: number; icu_capacity: number; ot_count: number }>(supabase.from('hospitals').select('*').eq('owner_id', profile.id).maybeSingle());
    },
    enabled: !!profile,
  });

  if (!hospital) return <EmptyState title="Hospital profile not found" hint="Complete hospital onboarding to manage capacity." />;
  const occupancy = hospital.bed_capacity ? Math.round(((hospital.bed_capacity - hospital.beds_available) / hospital.bed_capacity) * 100) : 0;

  return (
    <PageTransition>
      <PageHeader title={hospital.name} subtitle={`${hospital.city ?? ''} · ${hospital.type}`} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Beds available" value={`${hospital.beds_available.toString()}/${hospital.bed_capacity.toString()}`} icon={<IoBedOutline className="h-5 w-5" />} />
        <KpiCard label="ICU available" value={`${hospital.icu_available.toString()}/${hospital.icu_capacity.toString()}`} icon={<IoMedkitOutline className="h-5 w-5" />} />
        <KpiCard label="Occupancy" value={`${occupancy.toString()}%`} icon={<IoBusinessOutline className="h-5 w-5" />} />
        <KpiCard label="Operation theaters" value={hospital.ot_count} icon={<IoCarOutline className="h-5 w-5" />} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Occupancy (7 days)" config={{
          type: 'line',
          data: {
            labels: ['D-6', 'D-5', 'D-4', 'D-3', 'D-2', 'D-1', 'Today'],
            datasets: [{ label: 'Occupancy %', data: [78, 81, 76, 84, 82, 85, occupancy], borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,.12)', fill: true, tension: 0.4 }],
          },
        }} />
        <ChartCard title="Department load" config={{
          type: 'bar',
          data: {
            labels: ['ER', 'ICU', 'Surgery', 'Maternity', 'General'],
            datasets: [{ label: 'Patients', data: [42, hospital.icu_capacity - hospital.icu_available, 18, 12, 67], backgroundColor: ['#dc2626', '#d97706', '#0891b2', '#16a34a', '#64748b'], borderRadius: 8 }],
          },
        }} />
      </div>
    </PageTransition>
  );
}
