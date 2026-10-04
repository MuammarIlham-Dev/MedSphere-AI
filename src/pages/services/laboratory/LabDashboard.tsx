import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageTransition } from '@/components/transitions/PageTransition';
import { PageHeader, KpiCard, EmptyState, Skeleton } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  IoBeakerOutline,
  IoArrowForwardOutline,
  IoCheckmarkCircleOutline,
  IoDocumentTextOutline,
} from 'react-icons/io5';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import {
  useAcceptLabOrder,
  useAdvanceSampleStatus,
  useCreateLabReport,
  useDeliverLabReport,
  useLabOrders,
  useVerifyLabReport,
} from '@/hooks/queries/useLaboratoryQueries';
import { formatDateTime } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';

const nextSampleStatus: Record<string, string> = {
  ordered: 'collected',
  collected: 'in_transit',
  in_transit: 'received',
  received: 'processing',
  processing: 'analyzed',
};

const sampleTone = (status: string) => {
  if (status === 'analyzed') return 'success' as const;
  if (status === 'ordered') return 'warning' as const;
  if (status === 'processing') return 'brand' as const;
  return 'info' as const;
};

const orderTone = (status: string) => {
  if (status === 'delivered' || status === 'verified') return 'success' as const;
  if (status === 'completed') return 'info' as const;
  if (status === 'in_progress') return 'brand' as const;
  return 'warning' as const;
};

export default function LabDashboard() {
  const profile = useAuthStore((s) => s.profile);
  const toast = useUiStore((s) => s.toast);
  const [reportingItem, setReportingItem] = useState<string | null>(null);
  const [reportJson, setReportJson] = useState('{\n  "result": ""\n}');

  const { data: laboratory } = useQuery({
    queryKey: ['owned-laboratory', profile?.id],
    queryFn: () =>
      unwrap<{ id: string; name: string }>(
        supabase.from('laboratories').select('id, name').eq('owner_id', profile?.id ?? '').single(),
      ),
    enabled: !!profile,
  });

  const { data: orders, isLoading } = useLabOrders(laboratory?.id);
  const accept = useAcceptLabOrder();
  const advance = useAdvanceSampleStatus();
  const createReport = useCreateLabReport();
  const verify = useVerifyLabReport();
  const deliver = useDeliverLabReport();

  const stats = useMemo(() => {
    const rows = orders ?? [];
    const items = rows.flatMap((o) => o.items);
    return {
      orders: rows.length,
      processing: items.filter((i) => i.sample_status === 'processing').length,
      analyzed: items.filter((i) => i.sample_status === 'analyzed').length,
      reportsReady: items.filter((i) => ['completed', 'verified'].includes(i.report_status ?? '')).length,
    };
  }, [orders]);

  const submitReport = (orderId: string, testId: string) => {
    try {
      const parsed = JSON.parse(reportJson) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Report result must be a JSON object');
      }
      createReport.mutate(
        { orderId, testId, result: parsed as Record<string, unknown> },
        {
          onSuccess: () => {
            setReportingItem(null);
            setReportJson('{\n  "result": ""\n}');
          },
        },
      );
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Invalid report JSON');
    }
  };

  return (
    <PageTransition>
      <PageHeader
        title={laboratory?.name ?? 'Laboratory Operations'}
        subtitle="Accept diagnostic orders, track specimens, and publish verified reports"
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Open orders" value={stats.orders} icon={<IoBeakerOutline className="h-5 w-5" />} />
        <KpiCard label="Samples processing" value={stats.processing} icon={<IoBeakerOutline className="h-5 w-5 text-info-500" />} />
        <KpiCard label="Samples analyzed" value={stats.analyzed} icon={<IoCheckmarkCircleOutline className="h-5 w-5 text-success-500" />} />
        <KpiCard label="Reports ready" value={stats.reportsReady} icon={<IoDocumentTextOutline className="h-5 w-5 text-brand-500" />} />
      </div>

      <Card>
        <CardHeader
          title="Diagnostic Worklist"
          subtitle="The server enforces order, specimen, and publication states; report results stay behind the protected clinical boundary."
        />
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {isLoading && <div className="p-5"><Skeleton className="h-24 w-full" /></div>}
          {!isLoading && (orders ?? []).length === 0 && (
            <div className="p-10">
              <EmptyState title="No outstanding laboratory orders" hint="New doctor-ordered diagnostics will appear here." />
            </div>
          )}

          {(orders ?? []).map((order) => (
            <div key={order.id} className="p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-foreground">{order.patient_name}</h3>
                    <Badge tone={orderTone(order.status)}>{order.status.replace('_', ' ')}</Badge>
                    <Badge tone="neutral">{order.priority}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.hospital_name ? order.hospital_name + ' · ' : 'Independent referral · '}
                    {order.doctor_name ? 'Dr. ' + order.doctor_name : 'Doctor unavailable'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Ordered {formatDateTime(order.booked_at)}</p>
                </div>
                {order.status === 'pending' && (
                  <Button size="sm" loading={accept.isPending} onClick={() => accept.mutate({ orderId: order.id })}>
                    Accept order
                  </Button>
                )}
              </div>

              <div className="mt-4 space-y-3 border-l-2 border-slate-100 pl-4 dark:border-white/10">
                {order.items.map((item) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-white/10 dark:bg-surface-dark-muted/40">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <IoBeakerOutline className="h-4 w-4 text-brand-500" />
                          <span className="font-medium">{item.test_name}</span>
                          <span className="text-xs text-muted-foreground">{item.test_code}</span>
                          <Badge tone={sampleTone(item.sample_status)}>{item.sample_status.replace('_', ' ')}</Badge>
                          {item.report_status && (
                            <Badge tone={item.report_status === 'verified' || item.report_status === 'delivered' ? 'success' : 'info'}>
                              Report {item.report_status}
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {item.collected_at ? 'Collected ' + formatDateTime(item.collected_at) : 'Sample not yet collected'}
                          {item.report_code ? ' · ' + item.report_code : ''}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {order.status !== 'pending' && item.sample_status !== 'analyzed' && (
                          <Button size="sm" variant="secondary" loading={advance.isPending} onClick={() => advance.mutate({ itemId: item.id })}>
                            {'Advance → ' + (nextSampleStatus[item.sample_status]?.replace('_', ' ') ?? 'next state')}
                            <IoArrowForwardOutline className="ml-2" />
                          </Button>
                        )}
                        {item.sample_status === 'analyzed' && !item.report_id && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => {
                              setReportingItem(item.id);
                              setReportJson('{\n  "result": ""\n}');
                            }}
                          >
                            Create report
                          </Button>
                        )}
                        {item.report_id && item.report_status === 'completed' && (
                          <Button size="sm" loading={verify.isPending} onClick={() => verify.mutate({ reportId: item.report_id! })}>
                            Verify
                          </Button>
                        )}
                        {item.report_id && item.report_status === 'verified' && (
                          <Button size="sm" variant="success" loading={deliver.isPending} onClick={() => deliver.mutate({ reportId: item.report_id! })}>
                            Publish
                          </Button>
                        )}
                        {item.report_status === 'delivered' && <Badge tone="success">Published to EHR</Badge>}
                      </div>
                    </div>

                    {reportingItem === item.id && (
                      <div className="mt-4 rounded-xl border border-brand-200 bg-white p-4 dark:border-brand-900 dark:bg-surface-dark-soft">
                        <label className="text-sm font-medium text-foreground" htmlFor={'lab-report-' + item.id}>
                          Structured result JSON
                        </label>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Enter the laboratory result object only. The server stores it as protected clinical data.
                        </p>
                        <textarea
                          id={'lab-report-' + item.id}
                          value={reportJson}
                          onChange={(e) => setReportJson(e.target.value)}
                          className="mt-3 min-h-32 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs outline-none focus:border-brand-500 dark:border-white/10 dark:bg-surface-dark-muted"
                          spellCheck={false}
                        />
                        <div className="mt-3 flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setReportingItem(null)}>Cancel</Button>
                          <Button size="sm" loading={createReport.isPending} onClick={() => submitReport(order.id, item.test_id)}>
                            Save report
                          </Button>
                        </div>
                      </div>
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
