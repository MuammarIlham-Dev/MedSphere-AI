import { useState } from 'react';
import { PageHeader,KpiCard,EmptyState } from '@/components/ui/KpiCard';
import { Card,CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input,Select } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { PageTransition } from '@/components/transitions/PageTransition';
import { useAuthStore } from '@/stores/authStore';
import { useMyHospital } from '@/hooks/queries/useHospitalQueries';
import { useHospitalBloodRequests,useCreateHospitalBloodRequest,useCancelHospitalBloodRequest } from '@/hooks/queries/useHospitalBlood';
import { BLOOD_GROUPS,URGENCY_LEVELS,type BloodGroup,type Urgency } from '@/types';

export default function HospitalBlood(){
  const profile=useAuthStore(s=>s.profile);
  const {data:hospital}=useMyHospital(profile?.id);
  const {data:requests}=useHospitalBloodRequests(hospital?.id);
  const create=useCreateHospitalBloodRequest(hospital?.id);
  const cancel=useCancelHospitalBloodRequest();
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({patientName:'',bloodGroup:'O+' as BloodGroup,units:1,urgency:'standard' as Urgency,neededBy:'',notes:''});
  if(!hospital)return <EmptyState title="Hospital profile not found" hint="Complete hospital onboarding first." />;
  const pending=(requests??[]).filter(r=>['open','partially_fulfilled'].includes(r.status));
  const submit=()=>{
    if(!form.patientName.trim()||form.units<1)return;
    create.mutate({...form,neededBy:form.neededBy||undefined},{onSuccess:()=>{setOpen(false);setForm({...form,patientName:'',units:1,notes:''});}});
  };
  return <PageTransition>
    <PageHeader title="Blood Requisition" subtitle={hospital.name+' · request blood from the verified network'} actions={<Button variant="danger" onClick={()=>setOpen(true)}>Request blood</Button>}/>
    <div className="grid gap-4 sm:grid-cols-3">
      <KpiCard label="Open requisitions" value={pending.length}/>
      <KpiCard label="Completed requisitions" value={(requests??[]).filter(r=>r.status==='fulfilled').length}/>
      <KpiCard label="Units requested" value={(requests??[]).reduce((n,r)=>n+r.units,0)}/>
    </div>
    <Card className="mt-6">
      <CardHeader title="Hospital blood requisitions" subtitle="Patient identity stays inside the authorized hospital/blood-bank workflow."/>
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {(requests??[]).map(r=><div key={r.id} className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-slate-900 dark:text-white">{r.patient_name}</p><Badge tone={r.urgency==='critical'?'danger':r.urgency==='high'?'warning':'info'}>{r.urgency}</Badge><Badge tone={r.status==='fulfilled'?'success':r.status==='cancelled'?'neutral':'brand'}>{r.status.replace('_',' ')}</Badge></div>
          <p className="mt-1 text-sm text-slate-500">{r.blood_group} · {r.units_fulfilled}/{r.units} units fulfilled{r.needed_by?' · needed by '+new Date(r.needed_by).toLocaleString():''}</p>{r.notes&&<p className="mt-1 text-xs text-slate-400">{r.notes}</p>}</div>
          {['open','partially_fulfilled'].includes(r.status)&&<Button size="sm" variant="secondary" loading={cancel.isPending} onClick={()=>cancel.mutate(r.id)}>Cancel request</Button>}
        </div>)}
        {!requests?.length&&<div className="p-5"><EmptyState title="No blood requisitions yet" hint="Create a requisition when an outpatient or inpatient needs blood."/></div>}
      </div>
    </Card>
    <Modal open={open} onClose={()=>setOpen(false)} title="Request blood from network">
      <div className="space-y-4">
        <Input label="Patient name" value={form.patientName} onChange={e=>setForm({...form,patientName:e.target.value})}/>
        <div className="grid grid-cols-3 gap-3">
          <Select label="Blood group" value={form.bloodGroup} onChange={e=>setForm({...form,bloodGroup:e.target.value as BloodGroup})}>{BLOOD_GROUPS.map(b=><option key={b} value={b}>{b}</option>)}</Select>
          <Input label="Units" type="number" min={1} value={form.units} onChange={e=>setForm({...form,units:Number(e.target.value)})}/>
          <Select label="Urgency" value={form.urgency} onChange={e=>setForm({...form,urgency:e.target.value as Urgency})}>{URGENCY_LEVELS.map(u=><option key={u} value={u}>{u}</option>)}</Select>
        </div>
        <Input label="Needed by" type="datetime-local" value={form.neededBy} onChange={e=>setForm({...form,neededBy:e.target.value})}/>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Clinical/operational note
          <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-surface px-3.5 py-2.5 text-sm dark:border-white/15 dark:bg-surface-dark-muted"/>
        </label>
        <Button className="w-full" variant="danger" loading={create.isPending} disabled={!form.patientName.trim()||form.units<1} onClick={submit}>Send requisition</Button>
      </div>
    </Modal>
  </PageTransition>;
}
