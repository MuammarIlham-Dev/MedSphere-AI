import { PageTransition } from'@/components/transitions/PageTransition';
import { PageHeader, KpiCard, EmptyState, Skeleton } from'@/components/ui/KpiCard';
import { Card, CardHeader } from'@/components/ui/Card';
import { Button } from'@/components/ui/Button';
import { Badge } from'@/components/ui/Badge';
import { IoBeakerOutline, IoArrowForwardOutline } from'react-icons/io5';
import { useAuthStore } from'@/stores/authStore';
import { useLabOrders, useAdvanceSampleStatus } from'@/hooks/useLaboratory';
import { formatDateTime } from'@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';

export default function LabDashboard() {
 const profile = useAuthStore((s) => s.profile);
 const { data: laboratory } = useQuery({
  queryKey: ['owned-laboratory', profile?.id],
  queryFn: () => unwrap<{ id: string; name: string }>(supabase.from('laboratories').select('id, name').eq('owner_id', profile?.id ?? '').single()),
  enabled: !!profile,
 });
 const { data: orders, isLoading } = useLabOrders(laboratory?.id);
 const advance = useAdvanceSampleStatus();

 return (
 <PageTransition>
 <PageHeader 
 title={laboratory?.name ?? 'Laboratory Sample Tracking'}
 subtitle="Manage incoming test orders and sample lifecycles" 
 />

 <div className="grid gap-4 sm:grid-cols-3 mb-6">
 <KpiCard label="Pending Orders" value={orders?.length ?? 0} icon={<IoBeakerOutline className="w-5 h-5" />} />
 <KpiCard label="Samples Processing" value={(orders ?? []).flatMap((order) => order.items ?? []).filter((item: { sample_status: string }) => item.sample_status === 'processing').length} icon={<IoBeakerOutline className="w-5 h-5 text-info-500" />} />
 <KpiCard label="Samples Analyzed" value={(orders ?? []).flatMap((order) => order.items ?? []).filter((item: { sample_status: string }) => item.sample_status === 'analyzed').length} icon={<IoBeakerOutline className="w-5 h-5 text-success-500" />} />
 </div>

 <Card>
 <CardHeader title="Active Lab Orders" subtitle="Advance the state of samples through the testing pipeline" />
 <div className="divide-y divide-slate-100 dark:divide-white/5">
 {isLoading && <div className="p-5"><Skeleton className="h-24 w-full" /></div>}
 {!isLoading && orders?.length === 0 && (
 <div className="p-10">
 <EmptyState title="No active lab orders" hint="New test requests from doctors will appear here." />
 </div>
 )}
 {orders?.map((o) => (
 <div key={o.id} className="p-5">
 <div className="flex items-center gap-2 mb-3">
 <h3 className="font-semibold text-foreground">Patient: {o.patient?.full_name ??'Unknown'}</h3>
 <span className="text-xs text-muted-foreground">Ordered {formatDateTime(o.booked_at)}</span>
 </div>
 
 <div className="space-y-3 pl-4 border-l-2 border-slate-100">
 {o.items?.map((item: { id: string; sample_status: string; test?: { name: string; code: string } }) => (
 <div key={item.id} className="flex flex-col sm:flex-row gap-4 justify-between sm:items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100">
 <div>
 <div className="font-medium flex items-center gap-2">
 <IoBeakerOutline className="text-brand-500" />
 {item.test?.name ??'Lab Test'} <span className="text-xs text-muted-foreground">({item.test?.code})</span>
 </div>
 <div className="mt-1 flex items-center gap-2">
 <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status:</span>
 <Badge tone={
 item.sample_status ==='ordered' ?'warning' :
 item.sample_status ==='analyzed' ?'success' :'info'
 }>
 {item.sample_status.replace('_','')}
 </Badge>
 </div>
 </div>
 {item.sample_status !=='analyzed' && (
 <Button 
 size="sm" 
 variant="secondary"
 disabled={advance.isPending}
 onClick={() => { advance.mutate({ itemId: item.id, currentStatus: item.sample_status }); }}
 >
 Advance Pipeline
 <IoArrowForwardOutline className="ml-2" />
 </Button>
 )}
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </Card>
 </PageTransition>
 );
}
