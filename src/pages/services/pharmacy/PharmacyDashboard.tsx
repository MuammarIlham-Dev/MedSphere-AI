import { PageTransition } from'@/components/transitions/PageTransition';
import { PageHeader, KpiCard, EmptyState, Skeleton } from'@/components/ui/KpiCard';
import { Card, CardHeader } from'@/components/ui/Card';
import { Button } from'@/components/ui/Button';
import { Badge } from'@/components/ui/Badge';
import { IoMedicalOutline, IoCheckmarkCircleOutline, IoDocumentTextOutline } from'react-icons/io5';
import { useAuthStore } from'@/stores/authStore';
import { usePharmacyPrescriptions, useFulfillPrescription } from'@/hooks/queries/usePharmacyQueries';
import { formatDateTime } from'@/lib/utils';
import { useUiStore } from'@/stores/uiStore';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';

export default function PharmacyDashboard() {
 const profile = useAuthStore((s) => s.profile);
 const toast = useUiStore((s) => s.toast);
 const { data: pharmacy } = useQuery({
  queryKey: ['owned-pharmacy', profile?.id],
  queryFn: () => {
    if (!profile) return Promise.resolve({ id: '', name: '' });
    return unwrap<{ id: string; name: string }>(supabase.from('pharmacies').select('id, name').eq('owner_id', profile.id).single());
  },
  enabled: !!profile,
 });
 const { data: prescriptions, isLoading } = usePharmacyPrescriptions(pharmacy?.id);
 const fulfill = useFulfillPrescription();

  const fulfilledToday = (prescriptions ?? []).filter((p) => {
    if (p.status !== 'fulfilled') return false;
    const today = new Date().toISOString().substring(0, 10);
    return (p.updated_at || '').startsWith(today);
  }).length;

 return (
 <PageTransition>
 <PageHeader 
 title={pharmacy?.name ?? 'Pharmacy Fulfillment'}
 subtitle="Manage incoming digital prescriptions and inventory" 
 />

 <div className="grid gap-4 sm:grid-cols-3 mb-6">
 <KpiCard label="Pending Orders" value={(prescriptions ?? []).filter(p => p.status === 'pending').length} icon={<IoDocumentTextOutline className="w-5 h-5" />} />
 <KpiCard label="Prescription Items" value={(prescriptions ?? []).filter(p => p.status === 'pending').reduce((count, item) => count + (item.items?.length ?? 0), 0)} icon={<IoMedicalOutline className="w-5 h-5 text-warning-500" />} />
 <KpiCard label="Fulfilled Today" value={fulfilledToday} icon={<IoCheckmarkCircleOutline className="w-5 h-5 text-success-500" />} />
 </div>

 <Card>
 <CardHeader title="Incoming Prescriptions" subtitle="Digital prescriptions awaiting fulfillment" />
 <div className="divide-y divide-slate-100 dark:divide-white/5">
 {isLoading && <div className="p-5"><Skeleton className="h-20 w-full" /></div>}
 {!isLoading && prescriptions?.filter(p => p.status === 'pending').length === 0 && (
 <div className="p-10">
 <EmptyState title="No pending prescriptions" hint="All caught up! Digital prescriptions will appear here." />
 </div>
 )}
 {prescriptions?.filter(p => p.status === 'pending').map((p) => (
 <div key={p.id} className="p-5 flex flex-col md:flex-row gap-4 justify-between md:items-center">
 <div>
 <div className="flex items-center gap-2 mb-1">
 <h3 className="font-semibold text-foreground">{p.patient?.full_name ??'Unknown Patient'}</h3>
 <Badge tone="warning">Pending</Badge>
 </div>
 <p className="text-xs text-muted-foreground mb-3">Prescribed on {formatDateTime(p.created_at)} by {p.doctor?.specialty ??'Doctor'}</p>
 <div className="space-y-1">
  {p.items?.map((item: { id: string; medicine?: { name: string }; dosage: string; frequency: string; duration_days: number }) => (
 <div key={item.id} className="flex items-center gap-2 text-sm text-foreground">
 <IoMedicalOutline className="text-brand-500" />
 <span className="font-medium">{item.medicine?.name ??'Medicine'}</span>
 <span className="text-muted-foreground">— {item.dosage}, {item.frequency} for {item.duration_days} days</span>
 </div>
 ))}
 </div>
 </div>
 <div className="shrink-0 mt-4 md:mt-0">
 <Button 
 disabled={fulfill.isPending}
  onClick={() => {
    fulfill.mutate({ prescriptionId: p.id }, {
      onSuccess: () => { toast('success','Prescription fulfilled and patient notified.'); }
    });
  }}
 >
 <IoCheckmarkCircleOutline className="mr-2" />
 Mark Fulfilled
 </Button>
 </div>
 </div>
 ))}
 </div>
 </Card>
 </PageTransition>
 );
}
