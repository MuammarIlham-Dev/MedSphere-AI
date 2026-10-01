import { KpiCard, Skeleton, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { ChartCard } from '@/components/charts/ChartCard';
import { IoPeopleOutline, IoBusinessOutline, IoMedkitOutline, IoWaterOutline, IoBodyOutline, IoCalendarOutline } from 'react-icons/io5';
import { useGovOverview } from '@/hooks/useAdmin';

export default function GovDashboard() {
  const { data: o, isLoading } = useGovOverview();

  return (
    <PageTransition>
      <PageHeader title="National public health overview"
        subtitle="Anonymized, aggregate statistics — no personally identifiable data is exposed at this level" />
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Registered citizens" value={(o?.citizens ?? 0).toLocaleString()} icon={<IoPeopleOutline className="h-5 w-5" />} />
          <KpiCard label="Verified doctors" value={(o?.doctors ?? 0).toLocaleString()} icon={<IoMedkitOutline className="h-5 w-5" />} />
          <KpiCard label="Hospitals online" value={o?.hospitals ?? 0} icon={<IoBusinessOutline className="h-5 w-5" />} />
          <KpiCard label="Appointments today" value={o?.appointmentsToday ?? 0} icon={<IoCalendarOutline className="h-5 w-5" />} />
          <KpiCard label="Active emergencies" value={o?.activeEmergencies ?? 0} delta="Live" icon={<IoMedkitOutline className="h-5 w-5" />} />
          <KpiCard label="National blood units" value={(o?.bloodUnits ?? 0).toLocaleString()} icon={<IoWaterOutline className="h-5 w-5" />} />
          <KpiCard label="Organ waiting list" value={o?.waitingRecipients ?? 0} icon={<IoBodyOutline className="h-5 w-5" />} />
          <KpiCard label="Registered donors" value={o?.activeDonors ?? 0} icon={<IoBodyOutline className="h-5 w-5" />} />
        </div>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Weekly appointment volume" subtitle="Platform-wide" config={{
          type: 'line',
          data: {
            labels: ['W1', 'W2', 'W3', 'W4', 'W5', 'W6'],
            datasets: [{ label: 'Appointments', data: [1240, 1380, 1290, 1520, 1680, o?.appointmentsToday ?? 1500], borderColor: '#0891b2', backgroundColor: 'rgba(8,145,178,.12)', fill: true, tension: 0.4 }],
          },
        }} />
        <ChartCard title="Blood inventory by group" subtitle="Units, national" config={{
          type: 'bar',
          data: {
            labels: ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'],
            datasets: [{ label: 'Units', data: [42, 310, 38, 265, 35, 290, 18, 96], backgroundColor: '#dc2626', borderRadius: 8 }],
          },
        }} />
        <ChartCard title="Disease reporting trend" subtitle="Anonymized case reports" config={{
          type: 'line',
          data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [
              { label: 'Dengue', data: [120, 240, 380, 290, 180, 95], borderColor: '#d97706', tension: 0.4 },
              { label: 'Influenza', data: [300, 260, 210, 150, 110, 130], borderColor: '#2563eb', tension: 0.4 },
            ],
          },
        }} />
        <ChartCard title="Hospital occupancy by region" config={{
          type: 'bar',
          data: {
            labels: ['Dhaka', 'Chattogram', 'Khulna', 'Rajshahi', 'Sylhet', 'Barishal', 'Rangpur'],
            datasets: [{ label: 'Occupancy %', data: [88, 76, 69, 72, 64, 58, 61], backgroundColor: '#0891b2', borderRadius: 8 }],
          },
          options: { scales: { y: { max: 100 } } },
        }} />
      </div>
    </PageTransition>
  );
}
