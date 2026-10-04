import { useBloodBankDonorCommitments, useConfirmBroadcastDonorDonation } from '@/hooks/queries/useBloodFulfillmentQueries';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

export function BloodBankCommitmentInbox({ bankId }: { bankId: string }) {
  const { data: commitments, isLoading } = useBloodBankDonorCommitments(bankId);
  const confirm = useConfirmBroadcastDonorDonation();

  return (
    <Card className="lg:col-span-2">
      <CardHeader
        title="Confirmed donor commitments"
        subtitle="These donors have been confirmed by hospitals. Record the donation only after in-person screening and collection."
      />
      <div className="divide-y divide-slate-100 dark:divide-white/5">
        {isLoading && <div className="p-5 text-sm text-slate-500">Loading confirmed donor commitments…</div>}
        {!isLoading && !commitments?.length && (
          <div className="p-8 text-sm text-slate-500">No confirmed donor commitments are waiting for collection.</div>
        )}
        {commitments?.map((item) => (
          <div key={item.response_id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={item.broadcast_mode === 'emergency' ? 'danger' : 'info'}>
                  {item.broadcast_mode === 'emergency' ? '🚨 EMERGENCY' : 'NORMAL'}
                </Badge>
                <span className="font-bold">{item.donor_blood_group}</span>
                <span className="text-sm text-slate-500">{item.units} unit(s)</span>
              </div>
              <p className="mt-2 font-semibold">{item.donor_name}</p>
              <p className="text-xs text-slate-500">
                {item.hospital_name} · {item.hospital_city ?? item.donor_city ?? '—'}
                {item.needed_by ? ` · needed by ${new Date(item.needed_by).toLocaleString()}` : ''}
              </p>
              {item.donor_phone && (
                <p className="mt-1 text-xs text-slate-500">Donor phone: {item.donor_phone}</p>
              )}
              <p className="mt-1 text-[11px] text-slate-400">
                Confirmed {item.confirmed_at ? new Date(item.confirmed_at).toLocaleString() : '—'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {item.urgency === 'critical' && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-300">
                  <AlertTriangle className="h-4 w-4" /> Critical
                </span>
              )}
              <Button
                size="sm"
                variant="primary"
                loading={confirm.isPending}
                onClick={() => confirm.mutate({ responseId: item.response_id, bankId, units: item.units })}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" /> Record donation
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
