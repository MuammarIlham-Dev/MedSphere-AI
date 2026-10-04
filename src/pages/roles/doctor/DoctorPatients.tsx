import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader, EmptyState, Skeleton } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageTransition } from '@/components/transitions/PageTransition';
import { PatientEhrModal } from '@/components/ehr/PatientEhrModal';
import { useAuthStore } from '@/stores/authStore';
import { useMyDoctor } from '@/hooks/queries/useDoctorQueries';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { formatDateTime } from '@/lib/utils';
import { IoPeopleOutline, IoSearchOutline } from 'react-icons/io5';

interface PatientRow {
  patient_id: string;
  patient_name: string;
  last_seen: string;
  visits: number;
  active_status: string;
  appointment_id: string;
  type: string;
  reason: string | null;
}

export default function DoctorPatients() {
  const profile = useAuthStore((s) => s.profile);
  const { data: doctor, isLoading: doctorLoading } = useMyDoctor(profile?.id);
  const [query, setQuery] = useState('');
  const [ehrPatient, setEhrPatient] = useState<PatientRow | null>(null);

  const patients = useQuery({
    queryKey: ['doctor-patients', doctor?.id],
    queryFn: async (): Promise<PatientRow[]> => {
      const rows = await unwrap<any[]>(
        supabase.from('appointments')
          .select('id,patient_id,scheduled_at,status,type,reason,profiles!appointments_patient_id_fkey(full_name)')
          .eq('doctor_id', doctor!.id)
          .order('scheduled_at', { ascending: false })
          .limit(500),
      );
      const map = new Map<string, PatientRow>();
      for (const row of rows) {
        const name = row.profiles?.full_name ?? 'Unknown patient';
        const existing = map.get(row.patient_id);
        if (!existing) {
          map.set(row.patient_id, {
            patient_id: row.patient_id,
            patient_name: name,
            last_seen: row.scheduled_at,
            visits: 1,
            active_status: row.status,
            appointment_id: row.id,
            type: row.type,
            reason: row.reason,
          });
        } else {
          existing.visits += 1;
          if (new Date(row.scheduled_at).getTime() > new Date(existing.last_seen).getTime()) {
            existing.last_seen = row.scheduled_at;
            existing.active_status = row.status;
            existing.appointment_id = row.id;
            existing.type = row.type;
            existing.reason = row.reason;
          }
        }
      }
      return [...map.values()].sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());
    },
    enabled: !!doctor?.id,
  });

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return patients.data ?? [];
    return (patients.data ?? []).filter((p) =>
      p.patient_name.toLowerCase().includes(needle) ||
      p.reason?.toLowerCase().includes(needle) ||
      p.active_status.toLowerCase().includes(needle),
    );
  }, [patients.data, query]);

  if (doctorLoading) return <Skeleton className="h-40" />;
  if (!doctor || doctor.verification !== 'verified') {
    return <EmptyState title="Doctor verification required" hint="Patient workspace becomes available after your doctor profile is verified." />;
  }

  return (
    <PageTransition>
      <PageHeader
        title="Patients"
        subtitle="Patients connected to your care through appointments. Clinical details remain behind the EHR access boundary."
      />

      <Card>
        <CardHeader
          title={String(patients.data?.length ?? 0) + ' patients'}
          subtitle="Derived from your appointment history, not a manually maintained contact list."
          action={
            <div className="relative w-full sm:w-64">
              <IoSearchOutline className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search patients"
                className="w-full rounded-xl border border-slate-300 bg-surface py-2 pl-9 pr-3 text-sm dark:border-white/15 dark:bg-surface-dark-muted"
                aria-label="Search patients"
              />
            </div>
          }
        />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {patients.isLoading && <div className="p-5"><Skeleton className="h-16 w-full" /></div>}
          {!patients.isLoading && filtered.length === 0 && (
            <div className="p-5"><EmptyState title={query ? 'No matching patients' : 'No patients yet'} hint="Patients appear here after they book an appointment with you." /></div>
          )}
          {filtered.map((patient) => (
            <div key={patient.patient_id} className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  <IoPeopleOutline />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-white">{patient.patient_name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {patient.visits} visit{patient.visits === 1 ? '' : 's'} · last appointment {formatDateTime(patient.last_seen)}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{patient.type} · {patient.reason ?? 'General consultation'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={patient.active_status === 'completed' ? 'success' : 'brand'}>{patient.active_status.replace('_', ' ')}</Badge>
                <Button size="sm" variant="secondary" onClick={() => setEhrPatient(patient)}>Open EHR</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {ehrPatient && (
        <PatientEhrModal
          open
          onClose={() => setEhrPatient(null)}
          patientId={ehrPatient.patient_id}
          patientName={ehrPatient.patient_name}
          appointmentId={ehrPatient.appointment_id}
        />
      )}
    </PageTransition>
  );
}
