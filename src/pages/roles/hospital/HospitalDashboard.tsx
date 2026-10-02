import { KpiCard, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { ChartCard } from '@/components/charts/ChartCard';
import { useAuthStore } from '@/stores/authStore';
import { useMyHospital } from '@/hooks/queries/useHospitalQueries';
import { IoBedOutline, IoBusinessOutline, IoMedkitOutline, IoCarOutline } from 'react-icons/io5';
import { useRef, useState } from 'react';
import { useReveal } from '@/lib/gsap';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useUpdateCapacity } from '@/hooks/queries/useHospitalQueries';

export default function HospitalDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const { data: hospital } = useMyHospital(profile?.id);
  const updateCapacity = useUpdateCapacity();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [beds, setBeds] = useState(0);
  const [icu, setIcu] = useState(0);
  
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  if (!hospital) return <EmptyState title="Hospital profile not found" hint="Complete hospital onboarding to manage capacity." />;
  const occupancy = hospital.bed_capacity ? Math.round(((hospital.bed_capacity - hospital.beds_available) / hospital.bed_capacity) * 100) : 0;

  return (
    <PageTransition>
      <div ref={rootRef}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <PageHeader title={hospital.name} subtitle={`${hospital.city ?? ''} · ${hospital.type}`} />
        <Button 
          onClick={() => {
            setBeds(hospital.beds_available);
            setIcu(hospital.icu_available);
            setIsModalOpen(true);
          }}
        >
          Update Capacity
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Beds available" value={`${hospital.beds_available}/${hospital.bed_capacity}`} icon={<IoBedOutline className="h-5 w-5" />} />
        <KpiCard label="ICU available" value={`${hospital.icu_available}/${hospital.icu_capacity}`} icon={<IoMedkitOutline className="h-5 w-5" />} />
        <KpiCard label="Occupancy" value={`${occupancy}%`} icon={<IoBusinessOutline className="h-5 w-5" />} />
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
      
      {isModalOpen && (
        <div className="relative z-50">
          <div className="fixed inset-0 bg-black/30 dark:bg-black/60 transition-opacity" onClick={() => setIsModalOpen(false)} />
          <div className="fixed inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-dark-soft relative">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Update Capacity</h2>
              <p className="mt-2 text-sm text-slate-500">Adjust the current available beds and ICU units for {hospital.name}.</p>
              
              <div className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Available Beds (Max: {hospital.bed_capacity})</label>
                  <Input 
                    type="number" 
                    min={0}
                    max={hospital.bed_capacity}
                    value={beds} 
                    onChange={(e) => setBeds(parseInt(e.target.value) || 0)} 
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Available ICU (Max: {hospital.icu_capacity})</label>
                  <Input 
                    type="number"
                    min={0}
                    max={hospital.icu_capacity}
                    value={icu} 
                    onChange={(e) => setIcu(parseInt(e.target.value) || 0)} 
                  />
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
                <Button 
                  loading={updateCapacity.isPending}
                  onClick={() => {
                    updateCapacity.mutate({ id: hospital.id, beds_available: beds, icu_available: icu }, {
                      onSuccess: () => setIsModalOpen(false)
                    });
                  }}
                >
                  Save changes
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageTransition>
  );
}
