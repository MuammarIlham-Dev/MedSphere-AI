import { useEffect, useState } from 'react';
import { Droplet, Activity, HeartPulse } from 'lucide-react';
import { useDonorProfile, useRegisterDonor, useAllBloodInventories } from '@/hooks/queries/useBloodQueries';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { BLOOD_GROUPS, type BloodGroup } from '@/types';
import { BloodLifeSavingFeed } from '@/components/blood/BloodLifeSavingFeed';

export default function BloodDonation() {
  const { data: profile, isLoading } = useDonorProfile();
  const { mutate: register, isPending: isRegistering } = useRegisterDonor();
  const { data: inventories } = useAllBloodInventories();
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [isAvailable, setIsAvailable] = useState(true);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!profile) return;
    setBloodGroup(profile.blood_group);
    setIsAvailable(profile.is_available);
  }, [profile]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const lastDonation = profile?.last_donation_at ? new Date(profile.last_donation_at) : null;
  const nextEligibleDate = lastDonation ? new Date(lastDonation) : null;
  if (nextEligibleDate) nextEligibleDate.setMonth(nextEligibleDate.getMonth() + 4);
  const eligible = !nextEligibleDate || nextEligibleDate.getTime() <= now;
  const remaining = nextEligibleDate ? Math.max(0, nextEligibleDate.getTime() - now) : 0;
  const totalSeconds = Math.floor(remaining / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading donor profile…</div>;

  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <div><h1 className="flex items-center gap-3 text-2xl font-bold sm:text-3xl"><Droplet className="h-8 w-8 text-rose-500"/>Blood Network</h1><p className="mt-1 text-sm text-slate-500">A verified hospital demand network designed for rapid donor response.</p></div>

    <Card className={eligible && profile?.is_available ? 'border-emerald-200 dark:border-emerald-900' : 'border-amber-200 dark:border-amber-900'}>
      <div className="grid gap-5 p-5 md:grid-cols-[1fr_auto] md:items-center">
        <div><div className="flex flex-wrap items-center gap-2"><Badge tone={eligible ? 'success' : 'warning'}>{eligible ? 'ELIGIBLE NOW' : 'NOT ELIGIBLE'}</Badge>{profile?.is_available && eligible && <Badge tone="info">AVAILABLE FOR ALERTS</Badge>}</div><h2 className="mt-2 text-xl font-bold">{profile?.blood_group ?? 'Register as a donor'}</h2>{eligible?<p className="mt-1 text-sm text-slate-500">You can receive compatible blood broadcasts in your city when availability is enabled.</p>:<p className="mt-1 text-sm text-slate-500">Next eligibility countdown: <strong>{days}d {String(hours).padStart(2,'0')}:{String(minutes).padStart(2,'0')}:{String(seconds).padStart(2,'0')}</strong></p>}</div>
        <label className="flex items-center gap-2 text-sm"><Activity className="h-5 w-5 text-emerald-500"/><span>Available</span><input type="checkbox" checked={isAvailable} disabled={!eligible || !profile} onChange={e=>setIsAvailable(e.target.checked)}/></label>
      </div>
    </Card>

    <Card><CardHeader title="Donor registration" subtitle="Your blood group and availability control whether life-saving broadcasts reach you."/><div className="grid gap-4 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
      <label className="text-sm font-medium">Blood group<select className="mt-1 w-full rounded-xl border border-slate-300 bg-surface px-3 py-2.5 dark:border-white/10 dark:bg-surface-dark-muted" value={bloodGroup} onChange={e=>setBloodGroup(e.target.value as BloodGroup)}><option value="">Select blood group</option>{BLOOD_GROUPS.map(b=><option key={b} value={b}>{b}</option>)}</select></label>
      <Button loading={isRegistering} disabled={!bloodGroup} onClick={()=>bloodGroup&&register({blood_group:bloodGroup,is_available:isAvailable})}>{profile?'Save donor status':'Join blood network'}</Button>
    </div><p className="px-5 pb-5 text-xs text-slate-500">MedSphere is a coordination platform. Final donor eligibility and physical screening remain with the authorized blood service.</p></Card>

    <BloodLifeSavingFeed />

    <Card><CardHeader title="Network blood inventory" subtitle="Verified blood-bank inventory is a separate fulfillment channel from live donor broadcasts."/><div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
      {(inventories??[]).map((row:any)=><div key={row.bank_id+row.blood_group} className="rounded-xl border border-slate-200 p-4 dark:border-white/10"><p className="font-semibold">{row.blood_banks?.name??'Blood bank'}</p><p className="text-xs text-slate-500">{row.blood_banks?.city??'—'}</p><div className="mt-2 flex justify-between text-sm"><span>{row.blood_group}</span><span className="font-bold">{row.units_available} units</span></div></div>)}
      {!inventories?.length&&<p className="text-sm text-slate-500">No verified inventory available.</p>}
    </div></Card>

    <div className="rounded-xl border border-brand-200 bg-brand-50 p-4 text-sm text-brand-800 dark:border-brand-900 dark:bg-brand-950/30 dark:text-brand-200"><HeartPulse className="mr-2 inline h-4 w-4"/>Emergency responses remain subject to hospital screening. Only respond when you can safely reach the hospital within the requested window.</div>
  </div>;
}
