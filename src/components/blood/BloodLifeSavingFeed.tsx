import { useMemo } from 'react';
import { AlertTriangle, Clock3, MapPin, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardHeader } from '@/components/ui/Card';
import { useDonorProfile } from '@/hooks/queries/useBloodQueries';
import { useDonorBloodBroadcasts, useMyBloodBroadcastResponses, useRespondToBloodBroadcast, useWithdrawBloodBroadcastResponse } from '@/hooks/queries/useBloodBroadcastQueries';

function Countdown({ expiresAt }: { expiresAt: string }) {
  const remaining = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  const minutes = Math.floor(remaining / 60000);
  const hours = Math.floor(minutes / 60);
  return <span>{hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`}</span>;
}

export function BloodLifeSavingFeed() {
  const { data: donor } = useDonorProfile();
  const broadcasts = useDonorBloodBroadcasts();
  const responses = useMyBloodBroadcastResponses();
  const respond = useRespondToBloodBroadcast();
  const withdraw = useWithdrawBloodBroadcastResponse();

  const activeResponseIds = useMemo(() => new Set((responses.data ?? []).map(r => r.request_id)), [responses.data]);
  if (!donor?.is_eligible || !donor?.is_available) {
    return <Card><CardHeader title="Live blood alerts" subtitle="Only eligible and available donors receive response opportunities." /><div className="p-6 text-sm text-slate-500">You are currently not receiving live donor broadcasts. Turn on donation availability after you are medically eligible.</div></Card>;
  }

  return <div className="space-y-4">
    <Card>
      <CardHeader title="Life-saving blood alerts" subtitle="Verified hospitals in your city. Emergency requests appear first." />
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {broadcasts.isLoading && <div className="p-6 text-sm text-slate-500">Checking live blood alerts…</div>}
        {!broadcasts.isLoading && !broadcasts.data?.length && <div className="p-6 text-sm text-slate-500">No active compatible blood broadcasts right now.</div>}
        {(broadcasts.data ?? []).map(b => {
          const emergency = b.broadcast_mode === 'emergency';
          const joined = activeResponseIds.has(b.request_id);
          return <div key={b.request_id} className={`p-5 ${emergency ? 'bg-red-50/70 dark:bg-red-950/20' : ''}`}>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={emergency ? 'danger' : b.urgency === 'high' ? 'warning' : 'info'}>{emergency ? '🚨 EMERGENCY' : 'NORMAL'}</Badge>
                  <span className="font-bold">{b.blood_group}</span>
                  <span className="text-sm text-slate-500">{b.units} unit(s) needed</span>
                </div>
                <p className="mt-2 font-semibold">{b.hospital_name}</p>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{b.hospital_city ?? 'Your city'}{b.distance_km != null ? ` · ${b.distance_km} km` : ''}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />expires in <Countdown expiresAt={b.broadcast_expires_at}/></span>
                  {b.needed_by && <span>needed by {new Date(b.needed_by).toLocaleString()}</span>}
                  {b.donor_target_count && <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5"/>{b.response_count}/{b.donor_target_count} donor responses</span>}
                </div>
                {emergency && <p className="mt-3 text-xs font-semibold text-red-700 dark:text-red-300">Go only if you can safely reach the hospital within the requested window. Hospital screening remains mandatory.</p>}
              </div>
              <Button variant={emergency ? 'danger' : 'primary'} disabled={joined || respond.isPending} loading={respond.isPending} onClick={() => respond.mutate(b.request_id)}>
                {joined ? 'Response sent' : <><ShieldCheck className="mr-2 h-4 w-4"/>{emergency ? 'I can respond now' : 'I can help'}</>}
              </Button>
            </div>
          </div>;
        })}
      </div>
    </Card>

    {(responses.data ?? []).length > 0 && <Card>
      <CardHeader title="My active donor responses" subtitle="A response is a commitment, not proof of donation. Follow hospital screening instructions." />
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {(responses.data ?? []).map(r => <div key={r.response_id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="flex items-center gap-2"><Badge tone={r.broadcast_mode === 'emergency' ? 'danger' : 'info'}>{r.status}</Badge><span className="font-semibold">{r.blood_group} · {r.hospital_name}</span></div><p className="mt-1 text-xs text-slate-500">{r.hospital_address ?? r.hospital_city ?? 'Hospital'} · {r.needed_by ? `needed by ${new Date(r.needed_by).toLocaleString()}` : 'as soon as possible'}</p></div>
          <Button size="sm" variant="secondary" disabled={withdraw.isPending} onClick={() => withdraw.mutate(r.response_id)}>Withdraw</Button>
        </div>)}
      </div>
    </Card>}
    {responses.data?.some(r => r.broadcast_mode === 'emergency' && r.status === 'confirmed') && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"><AlertTriangle className="mr-2 inline h-4 w-4"/>Emergency donor responses are still subject to clinical screening at the hospital.</div>}
  </div>;
}
