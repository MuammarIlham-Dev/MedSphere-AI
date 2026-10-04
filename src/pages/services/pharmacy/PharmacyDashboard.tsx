import { PageTransition } from '@/components/transitions/PageTransition';
import { PageHeader, KpiCard, EmptyState, Skeleton } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { IoMedicalOutline, IoCheckmarkCircleOutline, IoDocumentTextOutline } from 'react-icons/io5';
import { useAuthStore } from '@/stores/authStore';
import { usePharmacyPrescriptions, useFulfillPrescription } from '@/hooks/queries/usePharmacyQueries';
import { formatDateTime } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';
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
      return unwrap<{ id: string; name: string }>(
        supabase.from('pharmacies').select('id, name').eq('owner_id', profile.id).single()
      );
    },
    enabled: !!profile,
  });

  const { data: prescriptions, isLoading } = usePharmacyPrescriptions(pharmacy?.id);
  const fulfill = useFulfillPrescription();

  const incoming = (prescriptions ?? []).filter(
    (p) => p.share_status === 'shared' || p.share_status === 'accepted'
  );
  const fulfilledToday = (prescriptions ?? []).filter((p) =>
    p.share_status === 'fulfilled'
    && new Date(p.share_updated_at).toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka' }) ===
      new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Dhaka' })
  ).length;

  return (
    <PageTransition>
      <PageHeader
        title={pharmacy?.name ?? 'Pharmacy Fulfillment'}
        subtitle="Manage prescriptions explicitly shared with this pharmacy"
      />

      <div className="grid gap-4 sm:grid-cols-3 mb-6">
        <KpiCard label="Pending Fulfillment" value={incoming.length} icon={<IoDocumentTextOutline className="w-5 h-5" />} />
        <KpiCard
          label="Prescription Items"
          value={incoming.reduce((count, prescription) => count + (prescription.items?.length ?? 0), 0)}
          icon={<IoMedicalOutline className="w-5 h-5 text-warning-500" />}
        />
        <KpiCard label="Fulfilled Today" value={fulfilledToday} icon={<IoCheckmarkCircleOutline className="w-5 h-5 text-success-500" />} />
      </div>

      <Card>
        <CardHeader title="Incoming Prescriptions" subtitle="Only patient-shared prescriptions appear here" />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {isLoading && <div className="p-5"><Skeleton className="h-20 w-full" /></div>}
          {!isLoading && incoming.length === 0 && (
            <div className="p-10">
              <EmptyState title="No shared prescriptions" hint="Patients appear here after explicitly sharing a prescription with this pharmacy." />
            </div>
          )}
          {incoming.map((p) => (
            <div key={p.share_id} className="p-5 flex flex-col md:flex-row gap-4 justify-between md:items-center">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone="warning">{p.share_status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Prescribed on {formatDateTime(p.created_at)} by {p.doctor?.specialty ?? 'Doctor'}
                </p>
                <div className="space-y-1">
                  {p.items?.map((item) => (
                    <div key={item.id} className="flex items-center gap-2 text-sm text-foreground">
                      <IoMedicalOutline className="text-brand-500" />
                      <span className="font-medium">{item.medicine?.name ?? 'Medicine'}</span>
                      <span className="text-muted-foreground">— {item.dosage}, {item.frequency} for {item.duration_days} days</span>
                    </div>
                  ))}
                </div>
              </div>
              <Button
                disabled={fulfill.isPending}
                onClick={() => {
                  fulfill.mutate({ shareId: p.share_id }, {
                    onSuccess: () => toast('success', 'Prescription fulfilled and patient record updated.'),
                  });
                }}
              >
                <IoCheckmarkCircleOutline className="mr-2" /> Mark Fulfilled
              </Button>
            </div>
          ))}
        </div>
      </Card>
    </PageTransition>
  );
}
