import { useBloodBankOffers, useConfirmBloodDonation } from '@/hooks/queries/useBloodQueries';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

export function BloodOfferInbox({ bankId }: { bankId: string }) {
  const { data: offers, isLoading } = useBloodBankOffers(bankId);
  const confirm = useConfirmBloodDonation();

  return <Card className='lg:col-span-2'>
    <CardHeader title='Donor Offers' subtitle='Matched offers that can be confirmed after physical donation.' />
    <div className='divide-y divide-slate-100 dark:divide-white/5'>
      {isLoading && <div className='p-5 text-sm text-slate-500'>Loading donor offers...</div>}
      {!isLoading && !offers?.length && <div className='p-8 text-sm text-slate-500'>No donor offers yet.</div>}
      {offers?.map((offer: any) => (
        <div key={offer.offer_id} className='p-5 flex flex-col md:flex-row md:items-center justify-between gap-4'>
          <div>
            <p className='font-semibold'>{offer.donor_name || 'Registered donor'}</p>
            <p className='text-xs text-slate-500'>{offer.donor_blood_group} · {offer.units} unit(s) · Request {offer.request_id}</p>
          </div>
          <div className='flex items-center gap-2'>
            <Badge tone={offer.status === 'fulfilled' ? 'success' : offer.status === 'accepted' ? 'info' : 'neutral'}>{offer.status}</Badge>
            {offer.status === 'accepted' && (
              <Button size='sm' disabled={confirm.isPending} onClick={() => confirm.mutate({ offerId: offer.offer_id, bankId })}>
                Confirm Donation
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  </Card>;
}
