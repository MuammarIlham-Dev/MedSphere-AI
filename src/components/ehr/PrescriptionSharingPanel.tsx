import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCancelPrescriptionShare, useMyPrescriptionShares, useMyPrescriptions, useSharePrescription, useVerifiedPharmacies } from '@/hooks/queries/useEhrQueries';
import { Share2, ShieldCheck } from 'lucide-react';

export function PrescriptionSharingPanel() {
  const { data: prescriptions, isLoading } = useMyPrescriptions();
  const { data: shares } = useMyPrescriptionShares();
  const { data: pharmacies } = useVerifiedPharmacies();
  const share = useSharePrescription();
  const cancel = useCancelPrescriptionShare();
  const [selected, setSelected] = useState<Record<string, string>>({});
  const byPrescription = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const item of shares ?? []) map.set(item.prescription_id, [...(map.get(item.prescription_id) ?? []), item]);
    return map;
  }, [shares]);

  return <Card className='p-5'>
    <div className='border-b border-slate-100 dark:border-white/5 pb-4'><div className='flex items-center gap-3'><Share2 className='w-5 h-5 text-brand-500' /><h2 className='text-lg font-semibold'>Prescription Sharing</h2></div><p className='text-sm text-slate-500 mt-1'>A pharmacy gets access only when you explicitly share a prescription.</p></div>
    <div className='mt-4 space-y-4'>
      {isLoading && <div className='text-sm text-slate-500'>Loading prescriptions...</div>}
      {!isLoading && prescriptions?.length === 0 && <div className='text-sm text-slate-500'>No clinician-issued prescriptions available.</div>}
      {prescriptions?.map((p: any) => {
        const active = (byPrescription.get(p.id) ?? []).filter((x) => x.status === 'shared' || x.status === 'accepted');
        const canShare = p.status === 'active' || p.status === 'pending';
        const pharmacyId = selected[p.id] ?? '';
        return <div key={p.id} className='rounded-xl border border-slate-200 dark:border-white/10 p-4'>
          <div className='flex items-start justify-between gap-3'><div><p className='font-medium'>Dr. {p.doctor?.full_name ?? 'Clinician'}</p><p className='text-xs text-slate-500'>{p.doctor?.specialty ?? 'Medical care'}</p></div><Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status}</Badge></div>
          {canShare && <div className='mt-3 flex flex-col sm:flex-row gap-2'><select value={selected[p.id] ?? ''} onChange={(e) => setSelected((prev) => ({ ...prev, [p.id]: e.target.value }))} className='flex-1 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-surface-dark-muted p-2 text-sm'><option value=''>Select verified pharmacy</option>{(pharmacies ?? []).filter((ph) => !active.some((s) => s.pharmacy_id === ph.id)).map((ph) => <option key={ph.id} value={ph.id}>{ph.name}{ph.city ? ' · ' + ph.city : ''}</option>)}</select><Button size='sm' disabled={!pharmacyId || share.isPending} onClick={() => share.mutate({ prescriptionId: p.id, pharmacyId }, { onSuccess: () => setSelected((prev) => ({ ...prev, [p.id]: '' })) })}>Share</Button></div>}
          {active.map((s) => <div key={s.id} className='mt-3 flex items-center justify-between rounded-lg bg-slate-50 dark:bg-white/5 p-3 text-sm'><span className='flex items-center gap-2'><ShieldCheck className='w-4 h-4 text-emerald-500' />{s.pharmacy?.name ?? 'Pharmacy'} · {s.status}</span><button type='button' onClick={() => cancel.mutate(s.id)} disabled={cancel.isPending} className='text-rose-600 font-medium'>Revoke</button></div>)}
        </div>;
      })}
    </div>
  </Card>;
}