import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { KpiCard, EmptyState, PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { cn, formatDateTime } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { IoWaterOutline, IoMegaphoneOutline, IoPeopleOutline } from 'react-icons/io5';
import { BloodOfferInbox } from '@/components/blood/BloodOfferInbox';
import { BloodBankCommitmentInbox } from '@/components/blood/BloodBankCommitmentInbox';
import { BloodBankCommitmentInbox } from '@/components/blood/BloodBankCommitmentInbox';
import { useBloodInventory, useBloodRequests, useCreateBloodRequest, useMyBank } from '@/hooks/queries/useBloodQueries';
import { HospitalBloodRequisitions } from '@/components/blood/HospitalBloodRequisitions';
import { bloodService } from '@/services/blood.service';
import { BLOOD_GROUPS, URGENCY_LEVELS, BLOOD_COMPAT, type BloodGroup, type Urgency } from '@/types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '@/stores/uiStore';

export default function BloodBankDashboard() {
  const { data: bank } = useMyBank();
  const { data: inventory } = useBloodInventory(bank?.id);
  const { data: requests } = useBloodRequests('open');
  const createRequest = useCreateBloodRequest();
  const toast = useUiStore((s) => s.toast);
  const qc = useQueryClient();
  const upsert = useMutation({
    mutationFn: bloodService.upsertInventory,
    onSuccess: () => { toast('success', 'Inventory updated'); void qc.invalidateQueries({ queryKey: ['blood-inventory'] }); },
  });

  const [requestOpen, setRequestOpen] = useState(false);
  const [form, setForm] = useState({ patient_name: '', blood_group: 'O+' as BloodGroup, units: 1, urgency: 'standard' as Urgency });
  const invMap = new Map((inventory ?? []).map((r) => [r.blood_group, r]));
  const totalUnits = (inventory ?? []).reduce((a, r) => a + r.units_available, 0);

  return (
    <PageTransition>
      <PageHeader title={bank ? bank.name : 'Blood network'}
        subtitle="Live inventory, emergency requests and donation campaigns"
        actions={<Button variant="danger" onClick={() => setRequestOpen(true)}>Request blood</Button>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <KpiCard label="Total units" value={totalUnits} icon={<IoWaterOutline className="h-5 w-5" />} />
        <KpiCard label="Open requests" value={(requests ?? []).length} icon={<IoMegaphoneOutline className="h-5 w-5" />} />
        <KpiCard label="Active donors" value="—" icon={<IoPeopleOutline className="h-5 w-5" />} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {bank && <BloodOfferInbox bankId={bank.id} />}
        {bank && <BloodBankCommitmentInbox bankId={bank.id} />}
        {bank && <BloodBankCommitmentInbox bankId={bank.id} />}
        {bank && (
          <Card>
            <CardHeader title="Inventory" subtitle="Tap a cell to adjust stock (audited)" />
            <div className="grid grid-cols-4 gap-2 p-5">
              {BLOOD_GROUPS.map((bg) => {
                const row = invMap.get(bg);
                const low = (row?.units_available ?? 0) < 5;
                return (
                  <button key={bg} onClick={() => {
                    const next = window.prompt(`Units available for ${bg}:`, String(row?.units_available ?? 0));
                    if (next == null) return;
                    const units = Number.parseInt(next, 10);
                    if (Number.isNaN(units) || units < 0) return toast('error', 'Enter a valid number');
                    upsert.mutate([{ bank_id: bank.id, blood_group: bg, units_available: units, units_reserved: row?.units_reserved ?? 0 }]);
                  }}
                    className={cn('rounded-xl border p-3 text-center transition-colors',
                      low ? 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950' : 'border-slate-200 dark:border-white/10')}>
                    <p className="text-sm font-bold">{bg}</p>
                    <p className={cn('text-lg font-semibold', low ? 'text-danger' : 'text-slate-700 dark:text-slate-200')}>
                      {row?.units_available ?? 0}
                    </p>
                    <p className="text-[10px] text-slate-400">units</p>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {bank && <HospitalBloodRequisitions bankId={bank.id} />} 

        <Card>
          <CardHeader title="Open requests" subtitle="Most urgent first" />
          <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-white/5">
            {(requests ?? [])
              .sort((a) => (a.urgency === 'critical' ? -1 : 1))
              .map((r) => (
                <li key={r.id} className="flex items-center justify-between px-5 py-3.5">
                  <div>
                    <p className="text-sm font-medium">{r.patient_name} needs {r.units}u of <span className="font-bold text-danger">{r.blood_group}</span></p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Compatible donors: {BLOOD_GROUPS.filter((d) => BLOOD_COMPAT[d].includes(r.blood_group)).join(', ')}
                      {r.needed_by ? ` · by ${formatDateTime(r.needed_by)}` : ''}
                    </p>
                  </div>
                  <Badge tone={r.urgency === 'critical' ? 'danger' : r.urgency === 'high' ? 'warning' : 'neutral'}>{r.urgency}</Badge>
                </li>
              ))}
            {(requests ?? []).length === 0 && <li className="p-5"><EmptyState title="No open requests" /></li>}
          </ul>
        </Card>
      </div>

      <Modal open={requestOpen} onClose={() => setRequestOpen(false)} title="Emergency blood request">
        <div className="space-y-4">
          <Input label="Patient name" value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} />
          <div className="grid grid-cols-3 gap-3">
            <Select label="Group" value={form.blood_group} onChange={(e) => setForm({ ...form, blood_group: e.target.value as BloodGroup })}>
              {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
            </Select>
            <Input label="Units" type="number" min={1} value={form.units} onChange={(e) => setForm({ ...form, units: Number(e.target.value) })} />
            <Select label="Urgency" value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value as Urgency })}>
              {URGENCY_LEVELS.map((u) => <option key={u} value={u}>{u}</option>)}
            </Select>
          </div>
          <Button className="w-full" variant="danger" loading={createRequest.isPending}
            disabled={!form.patient_name}
            onClick={() => createRequest.mutate(form, { onSuccess: () => setRequestOpen(false) })}>
            Broadcast request
          </Button>
        </div>
      </Modal>
    </PageTransition>
  );
}
