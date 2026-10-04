import { PageHeader, EmptyState } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { ScheduleSettings } from '@/components/doctor/ScheduleSettings';
import { DoctorProfileSettings } from '@/components/doctor/DoctorProfileSettings';
import { DoctorCredentials } from '@/components/doctor/DoctorCredentials';
import { useAuthStore } from '@/stores/authStore';
import { useMyDoctor } from '@/hooks/queries/useDoctorQueries';
import { FullPageLoader } from '@/components/ui/Spinner';

export default function DoctorSchedule() {
  const profile = useAuthStore((s) => s.profile);
  const { data: doctor, isLoading } = useMyDoctor(profile?.id);

  if (isLoading) return <FullPageLoader />;
  if (!doctor) return <EmptyState title="Doctor profile not found" hint="Complete doctor onboarding before configuring your practice." />;
  if (doctor.verification !== 'verified') {
    return <EmptyState title="Doctor verification required" hint="Schedule publication is available after your professional profile is verified." />;
  }

  return (
    <PageTransition>
      <PageHeader
        title="Practice Schedule"
        subtitle="Manage clinic and video availability separately. Published slots are used by the doctor-booking workflow."
      />
      <ScheduleSettings doctorId={doctor.id} />
      <DoctorProfileSettings doctor={doctor} />
      <DoctorCredentials doctor={doctor} />
    </PageTransition>
  );
}
