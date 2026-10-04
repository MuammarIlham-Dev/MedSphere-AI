import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageHeader, KpiCard, EmptyState } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { PageTransition } from '@/components/transitions/PageTransition';
import { useAuthStore } from '@/stores/authStore';
import { useMyHospital } from '@/hooks/queries/useHospitalQueries';
import { useHospitalAdmissions, useHospitalBedRequests, useHospitalBeds, useApproveBedRequest } from '@/hooks/queries/useBedQueries';
import { useHospitalClinicians, useRejectBedRequest, useAssignAdmissionDoctor, useTransferAdmission, useDischargeInpatient } from '@/hooks/queries/useHospitalOperations';

type Action =
  | { kind: 'reject'; requestId: string }
  | { kind: 'assign'; admissionId: string; doctorId: string | null }
  | { kind: 'transfer'; admissionId: string }
  | { kind: 'discharge'; admissionId: string };

export default function InpatientOperations() {
  const profile = useAuthStore((s) => s.profile);
  const { data: hospital } = useMyHospital(profile?.id);
  const hospitalId = hospital?.id;
  const beds = useHospitalBeds(hospitalId);
  const requests = useHospitalBedRequests(hospitalId);
  const admissions = useHospitalAdmissions(hospitalId);
  const clinicians = useHospitalClinicians(hospitalId);
  const approve = useApproveBedRequest(hospitalId);
  const reject = useRejectBedRequest(hospitalId);
  const assign = useAssignAdmissionDoctor(hospitalId);
  const transfer = useTransferAdmission(hospitalId);
  const discharge = useDischargeInpatient(hospitalId);

  const [action, setAction] = useState<Action | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [targetBedId, setTargetBedId] = useState('');

  const availableBeds = useMemo(() => (beds.data ?? []).filter((b: any) => b.status === 'available'), [beds.data]);
  const pendingRequests = useMemo(() => (requests.data ?? []).filter((r: any) => ['requested', 'reviewing'].includes(r.status)), [requests.data]);
  const activeAdmissions = useMemo(() => (admissions.data ?? []).filter((a: any) => a.status === 'admitted'), [admissions.data]);
  const cliniciansById = useMemo(() => new Map((clinicians.data ?? []).map((d) => [d.doctor_id, d])), [clinicians.data]);

  const closeAction = () => {
    setAction(null);
    setNotes('');
    setReason('');
    setTargetBedId('');
  };

  if (!hospital) return <EmptyState title="Hospital profile not found" hint="Complete hospital onboarding first." />;

  const submit = () => {
    if (!action) return;
    if (action.kind === 'reject') {
      reject.mutate({ requestId: action.requestId, notes }, { onSuccess: closeAction });
    } else if (action.kind === 'assign') {
      assign.mutate({ admissionId: action.admissionId, doctorId: action.doctorId }, { onSuccess: closeAction });
    } else if (action.kind === 'transfer') {
      if (!targetBedId || !reason.trim()) return;
      transfer.mutate({ admissionId: action.admissionId, targetBedId, reason, notes }, { onSuccess: closeAction });
    } else {
      discharge.mutate({ admissionId: action.admissionId, notes }, { onSuccess: closeAction });
    }
  };

  const isPending = approve.isPending || reject.isPending || assign.isPending || transfer.isPending || discharge.isPending;

  return (
    <PageTransition>
      <PageHeader title="Inpatient Operations" subtitle={(hospital.name + ' · admissions, bed requests, assignments, transfers and discharge')} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active admissions" value={activeAdmissions.length} />
        <KpiCard label="Pending bed requests" value={pendingRequests.length} />
        <KpiCard label="Reserved beds" value={(beds.data ?? []).filter((b: any) => b.status === 'reserved').length} />
        <KpiCard label="Available beds" value={availableBeds.length} />
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/app/hospital/beds"><Button variant="secondary" size="sm">Manage inventory</Button></Link>
        <Link to="/app/hospital"><Button variant="ghost" size="sm">Hospital overview</Button></Link>
      </div>

      <Card className="mt-6">
        <CardHeader title="Pending bed requests" subtitle="Approve or decline independently from doctor booking." />
        <div>
          {pendingRequests.map((r: any) => (
            <div key={r.id} className="flex flex-col gap-3 border-b border-slate-100 p-5 last:border-b-0 dark:border-white/5 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white">{r.patient_name_snapshot}</p>
                  {r.is_emergency && <Badge tone="danger">Emergency</Badge>}
                  <Badge tone={r.status === 'reviewing' ? 'warning' : 'info'}>{r.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">{r.category} · {r.reason}</p>
                <p className="mt-1 text-xs text-slate-400">Requested {new Date(r.requested_from).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" loading={approve.isPending} onClick={() => approve.mutate({ requestId: r.id })}>Approve & reserve</Button>
                <Button size="sm" variant="danger" onClick={() => setAction({ kind: 'reject', requestId: r.id })}>Decline</Button>
              </div>
            </div>
          ))}
          {pendingRequests.length === 0 && <EmptyState title="No pending bed requests" hint="New independent bed requests will appear here." />}
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Active inpatient stays" subtitle="Assign a verified hospital clinician, move beds atomically, or discharge with notes." />
        <div>
          {activeAdmissions.map((a: any) => {
            const currentDoctor = a.doctor_id ? cliniciansById.get(a.doctor_id) : undefined;
            return (
              <div key={a.id} className="border-b border-slate-100 p-5 last:border-b-0 dark:border-white/5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{a.patient_name_snapshot}</p>
                    <p className="mt-1 text-sm text-slate-500">{a.admission_reason}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge tone="info">Bed {a.bed_id.slice(0, 8)}</Badge>
                      {currentDoctor ? <Badge tone="success">Dr. {currentDoctor.full_name}</Badge> : <Badge tone="warning">No clinician assigned</Badge>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'assign', admissionId: a.id, doctorId: a.doctor_id ?? null })}>Assign clinician</Button>
                    <Button size="sm" variant="secondary" onClick={() => setAction({ kind: 'transfer', admissionId: a.id })}>Transfer bed</Button>
                    <Button size="sm" variant="danger" onClick={() => setAction({ kind: 'discharge', admissionId: a.id })}>Discharge</Button>
                  </div>
                </div>
              </div>
            );
          })}
          {activeAdmissions.length === 0 && <EmptyState title="No active inpatient stays" hint="Approved bed reservations can be admitted from Bed Management." />}
        </div>
      </Card>

      {action && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 h-full w-full bg-black/40" aria-label="Close" onClick={closeAction} />
          <div className="absolute inset-x-4 top-1/2 max-h-[90vh] -translate-y-1/2 overflow-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-surface-dark-soft sm:left-1/2 sm:right-auto sm:w-[32rem] sm:-translate-x-1/2">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {action.kind === 'reject' ? 'Decline bed request' : action.kind === 'assign' ? 'Assign inpatient clinician' : action.kind === 'transfer' ? 'Transfer inpatient bed' : 'Discharge inpatient'}
            </h2>
            <p className="mt-1 text-sm text-slate-500">The server re-checks hospital ownership and current record state before committing.</p>

            {action.kind === 'assign' && (
              <Select label="Clinician" value={action.doctorId ?? ''} onChange={(e) => setAction({ ...action, doctorId: e.target.value || null })} className="mt-5">
                <option value="">Unassigned</option>
                {(clinicians.data ?? []).map((d) => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.full_name} · {d.specialty ?? 'General'}</option>)}
              </Select>
            )}

            {action.kind === 'transfer' && (
              <>
                <Select label="Target available bed" value={targetBedId} onChange={(e) => setTargetBedId(e.target.value)} className="mt-5">
                  <option value="">Select a bed</option>
                  {availableBeds.map((b: any) => <option key={b.id} value={b.id}>{b.ward_name} · {b.bed_number} · {b.category}</option>)}
                </Select>
                <Input label="Transfer reason" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-4" placeholder="e.g. Higher level of monitoring required" />
              </>
            )}

            {action.kind !== 'assign' && (
              <label className="mt-4 block text-xs font-medium text-slate-600 dark:text-slate-300">
                {action.kind === 'reject' ? 'Review note' : action.kind === 'discharge' ? 'Discharge note' : 'Additional note'}
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4}
                  className="mt-1.5 w-full rounded-xl border border-slate-300 bg-surface px-3.5 py-2.5 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-white/15 dark:bg-surface-dark-muted dark:text-white"
                  placeholder="Record the operational note that should remain with the workflow." />
              </label>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" onClick={closeAction}>Cancel</Button>
              <Button variant={action.kind === 'reject' || action.kind === 'discharge' ? 'danger' : 'primary'}
                loading={isPending}
                disabled={action.kind === 'transfer' && (!reason.trim() || !targetBedId)}
                onClick={submit}>
                {action.kind === 'reject' ? 'Decline request' : action.kind === 'assign' ? 'Save assignment' : action.kind === 'transfer' ? 'Transfer bed' : 'Confirm discharge'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </PageTransition>
  );
}
