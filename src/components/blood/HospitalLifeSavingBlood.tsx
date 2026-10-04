import { useState } from 'react';
import { AlertTriangle, Clock3, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Input, Select } from '@/components/ui/Input';
import { BLOOD_GROUPS, type BloodGroup } from '@/types';
import { useCreateHospitalBloodBroadcast, useHospitalBloodBroadcastResponses, useHospitalBloodBroadcasts, useConfirmHospitalBloodResponse, useDeclineHospitalBloodResponse, useCloseHospitalBloodBroadcast } from '@/hooks/queries/useBloodBroadcastQueries';

export function HospitalLifeSavingBlood({ hospitalId }: { hospitalId: string }) {
  const broadcasts=useHospitalBloodBroadcasts(hospitalId);
  const create=useCreateHospitalBloodBroadcast();
  const confirm=useConfirmHospitalBloodResponse();
  const decline=useDeclineHospitalBloodResponse();
  const close=useCloseHospitalBloodBroadcast();
  const [open,setOpen]=useState(false); const [selected,setSelected]=useState<string|null>(null);
  const [form,setForm]=useState({patientName:'',bloodGroup:'O+' as BloodGroup,units:1,mode:'normal' as 'normal'|'emergency',neededBy:'',duration:1440,target:''});
  const responses=useHospitalBloodBroadcastResponses(selected ?? undefined);
  const submit=()=>{
    if(!form.patientName.trim()||form.units<1)return;
    const neededBy=form.neededBy?new Date(form.neededBy).toISOString():undefined;
    create.mutate({hospitalId,patientName:form.patientName,bloodGroup:form.bloodGroup,units:form.units,broadcastMode:form.mode,urgency:form.mode==='emergency'?'critical':'standard',neededBy,durationMinutes:form.duration,donorTargetCount:form.target?Number(form.target):undefined},{onSuccess:()=>{setOpen(false);setSelected(null);setForm({...form,patientName:'',units:1,target:''});}});
  };
  return <Card className="mt-6 border-rose-200 dark:border-rose-900">
    <CardHeader title="Life-saving donor broadcasts" subtitle="Broadcast to compatible, eligible, available and currently uncommitted donors in this hospital's city." action={<Button variant="danger" onClick={()=>setOpen(true)}>New donor broadcast</Button>}/>
    <div className="divide-y divide-slate-100 dark:divide-white/5">
      {(broadcasts.data??[]).map(b=>{
        const active=!b.broadcast_closed_at && b.broadcast_expires_at && new Date(b.broadcast_expires_at)>new Date() && b.status!=='fulfilled';
        return <div key={b.request_id} className={b.broadcast_mode==='emergency'?'p-5 bg-red-50/70 dark:bg-red-950/20':'p-5'}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div><div className="flex flex-wrap items-center gap-2"><Badge tone={b.broadcast_mode==='emergency'?'danger':'info'}>{b.broadcast_mode==='emergency'?'🚨 EMERGENCY':'NORMAL'}</Badge><span className="font-semibold">{b.blood_group} · {b.units} unit(s)</span><Badge tone={b.status==='fulfilled'?'success':active?'brand':'neutral'}>{b.status}</Badge></div>
            <p className="mt-1 text-sm text-slate-500">{b.patient_name} · {b.response_count}{b.donor_target_count?'/'+b.donor_target_count:''} donor responses{b.needed_by?' · needed by '+new Date(b.needed_by).toLocaleString():''}</p><p className="mt-1 text-xs text-slate-400">{b.broadcast_expires_at?'expires '+new Date(b.broadcast_expires_at).toLocaleString():''}</p></div>
            <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" onClick={()=>setSelected(b.request_id)}><Users className="mr-1 h-4 w-4"/>View donor queue</Button>{active&&<Button size="sm" variant="secondary" loading={close.isPending} onClick={()=>close.mutate(b.request_id)}>Stop broadcast</Button>}</div>
          </div></div>;
      })}
      {!broadcasts.data?.length&&<div className="p-6 text-sm text-slate-500">No donor broadcasts yet. Stored blood-bank requisitions remain available below.</div>}
    </div>
    <Modal open={open} onClose={()=>setOpen(false)} title="Create life-saving donor broadcast">
      <div className="space-y-4"><div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">Use emergency only when blood is genuinely time-critical. The donor still requires physical clinical screening.</div>
      <Input label="Patient name" value={form.patientName} onChange={e=>setForm({...form,patientName:e.target.value})}/>
      <div className="grid grid-cols-3 gap-3"><Select label="Blood group" value={form.bloodGroup} onChange={e=>setForm({...form,bloodGroup:e.target.value as BloodGroup})}>{BLOOD_GROUPS.map(b=><option key={b}>{b}</option>)}</Select><Input label="Units" type="number" min={1} value={form.units} onChange={e=>setForm({...form,units:Number(e.target.value)})}/><Select label="Mode" value={form.mode} onChange={e=>setForm({...form,mode:e.target.value as 'normal'|'emergency'})}><option value="normal">Normal</option><option value="emergency">Emergency</option></Select></div>
      {form.mode==='emergency'&&<div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><AlertTriangle className="h-4 w-4 shrink-0"/><span>Emergency broadcasts are critical alerts and require a needed-by time.</span></div>}
      <div className="grid gap-3 sm:grid-cols-2"><Input label="Needed by" type="datetime-local" value={form.neededBy} onChange={e=>setForm({...form,neededBy:e.target.value})}/><Input label="Broadcast duration (minutes)" type="number" min={15} max={form.mode==='emergency'?1440:10080} value={form.duration} onChange={e=>setForm({...form,duration:Number(e.target.value)})}/></div>
      <div className="grid gap-3 sm:grid-cols-2"><Input label="Stop after donor responses (optional)" type="number" min={1} max={form.units} value={form.target} onChange={e=>setForm({...form,target:e.target.value})}/><div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-white/5"><Clock3 className="mr-1 inline h-4 w-4"/>Broadcast automatically closes at expiry or when the donor target is reached.</div></div>
      <Button className="w-full" variant="danger" loading={create.isPending} disabled={!form.patientName.trim()||form.units<1||(form.mode==='emergency'&&!form.neededBy)} onClick={submit}>Activate donor broadcast</Button></div>
    </Modal>
    <Modal open={!!selected} onClose={()=>setSelected(null)} title="Donor response queue" wide><div className="space-y-3">
      {!responses.data?.length&&<p className="py-8 text-center text-sm text-slate-500">No active donor responses yet.</p>}
      {(responses.data??[]).map(r=><div key={r.response_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Badge tone={r.status==='confirmed'?'success':'info'}>{r.status}</Badge><b>{r.donor_name}</b><span className="text-xs text-slate-500">{r.donor_blood_group} · {r.donor_city??'—'}</span></div><p className="mt-1 text-xs text-slate-500">{new Date(r.responded_at).toLocaleString()}{r.status==='confirmed'&&r.donor_phone?' · '+r.donor_phone:''}</p></div>{r.status==='queued'&&<div className="flex gap-2"><Button size="sm" loading={confirm.isPending} onClick={()=>confirm.mutate(r.response_id)}>Confirm</Button><Button size="sm" variant="secondary" loading={decline.isPending} onClick={()=>decline.mutate(r.response_id)}>Decline</Button></div>}</div>)}
    </div></Modal>
  </Card>;
}