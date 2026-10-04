import { useMemo, useState } from 'react';
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
  useLaboratoryWorkspace,
  useLaboratoryMembers,
  useAddLaboratoryMember,
  useRemoveLaboratoryMember,
  useLaboratoryReportArchive,
  useAmendLabReport,
} from '@/hooks/queries/useLaboratoryQueries';
import { formatDateTime } from '@/lib/utils';
import { laboratoryService } from '@/services/laboratory.service';
import { LabResultEditor } from '@/components/laboratory/LabResultEditor';
import { LabResultView } from '@/components/laboratory/LabResultView';
import { createEmptyLabResult, parseStructuredLabResult, type StructuredLabResult } from '@/types/laboratory';

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
  const [staffDhi, setStaffDhi] = useState('');
  const [staffRole, setStaffRole] = useState('technologist');
  const [reportingItem, setReportingItem] = useState<string | null>(null);
  const [reportResult, setReportResult] = useState<StructuredLabResult>(createEmptyLabResult());
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [amendmentReportId, setAmendmentReportId] = useState<string | null>(null);
  const [amendmentReason, setAmendmentReason] = useState('');
  const [amendmentResult, setAmendmentResult] = useState<StructuredLabResult>(createEmptyLabResult());
  const [amendmentFile, setAmendmentFile] = useState<File | null>(null);

  const { data: workspace } = useLaboratoryWorkspace();
  const laboratory = workspace ? { id: workspace.laboratory_id, name: workspace.laboratory_name } : null;
  const { data: orders, isLoading } = useLabOrders(laboratory?.id);
  const { data: members } = useLaboratoryMembers(laboratory?.id, workspace?.staff_role === 'manager');
  const canReview = workspace?.staff_role === 'reviewer' || workspace?.staff_role === 'manager';
  const { data: reportArchive } = useLaboratoryReportArchive(laboratory?.id, canReview);
  const amendReport = useAmendLabReport();
  const addMember = useAddLaboratoryMember();
  const removeMember = useRemoveLaboratoryMember();
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

  const openDocument = async (reportId: string) => {
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');
    try {
      const url = await laboratoryService.openReportDocument(reportId);
      if (popup) popup.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      popup?.close();
      toast('error', error instanceof Error ? error.message : 'Could not open laboratory document');
    }
  };

  const submitStaff = () => {
    if (!laboratory || workspace?.staff_role !== 'manager' || !staffDhi.trim()) return;
    addMember.mutate({ labId: laboratory.id, digitalHealthId: staffDhi.trim(), staffRole });
    setStaffDhi('');
  };

  const submitReport = (orderId: string, testId: string) => {
    createReport.mutate(
      { orderId, testId, result: reportResult, file: reportFile },
      {
        onSuccess: () => {
          setReportingItem(null);
          setReportResult(createEmptyLabResult());
          setReportFile(null);
        },
      },
    );
  };

  const submitAmendment = () => {
    if (!amendmentReportId || amendmentReason.trim().length < 5) {
      toast('error', 'Add a clear amendment reason (at least 5 characters)');
      return;
    }
    amendReport.mutate(
      {
        reportId: amendmentReportId,
        result: amendmentResult,
        amendmentReason: amendmentReason.trim(),
        file: amendmentFile,
      },
      {
        onSuccess: () => {
          setAmendmentReportId(null);
          setAmendmentReason('');
          setAmendmentResult(createEmptyLabResult());
          setAmendmentFile(null);
        },
      },
    );
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

      {workspace?.staff_role === 'manager' && laboratory && (
        <Card className="mb-6">
          <CardHeader title="Laboratory team & quality control" subtitle="Add laboratory accounts as technologists, reviewers, or managers. A reviewer cannot verify or publish a report they authored." />
          <div className="p-5">
            <div className="grid gap-3 md:grid-cols-[1fr_180px_auto]">
              <input value={staffDhi} onChange={(e) => setStaffDhi(e.target.value)} placeholder="Staff Digital Health ID" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-surface-dark-muted" />
              <select value={staffRole} onChange={(e) => setStaffRole(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-surface-dark-muted">
                <option value="technologist">Technologist</option>
                <option value="reviewer">Reviewer</option>
                <option value="manager">Manager</option>
              </select>
              <Button loading={addMember.isPending} disabled={!staffDhi.trim()} onClick={submitStaff}>Add staff</Button>
            </div>
            <div className="mt-4 space-y-2">
              {(members ?? []).map((member) => (
                <div key={member.member_id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10">
                  <div>
                    <p className="text-sm font-medium">{member.full_name} <span className="text-xs text-slate-400">· {member.digital_health_id}</span></p>
                    <p className="text-xs capitalize text-slate-500">{member.staff_role} · {member.active ? 'Active' : 'Inactive'}</p>
                  </div>
                  {member.active && <Button size="sm" variant="danger" loading={removeMember.isPending} onClick={() => removeMember.mutate({ memberId: member.member_id, labId: laboratory.id })}>Remove</Button>}
                </div>
              ))}
              {!members?.length && <p className="text-sm text-slate-400">No additional laboratory staff are assigned yet.</p>}
            </div>
          </div>
        </Card>
      )}

      {canReview && (
        <Card className="mb-6">
          <CardHeader
            title="Report review & amendments"
            subtitle="Delivered reports are immutable. Corrections create a new version that stays off the patient record until independently verified and published."
          />
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {(reportArchive ?? []).map((report) => (
              <div key={report.report_id} className="p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{report.test_name ?? 'Laboratory report'} · {report.patient_name}</h3>
                      <Badge tone={report.status === 'delivered' ? 'success' : report.status === 'verified' ? 'info' : 'warning'}>
                        v{report.version_no} · {report.status}
                      </Badge>
                      {report.is_current && <Badge tone="success">Current</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {report.report_code} · {formatDateTime(report.created_at)}
                      {report.amendment_reason ? ' · Amendment: ' + report.amendment_reason : ''}
                    </p>
                    <div className="mt-3">
                      <LabResultView result={parseStructuredLabResult(report.result_json)} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {report.file_id && <Button size="sm" variant="secondary" onClick={() => void openDocument(report.report_id)}>Open document</Button>}
                    {report.status === 'completed' && (
                      <Button size="sm" loading={verify.isPending} onClick={() => verify.mutate({ reportId: report.report_id })}>Verify</Button>
                    )}
                    {report.status === 'verified' && (
                      <Button size="sm" variant="success" loading={deliver.isPending} onClick={() => deliver.mutate({ reportId: report.report_id })}>Publish</Button>
                    )}
                    {report.status === 'delivered' && report.is_current && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setAmendmentReportId(report.report_id);
                          setAmendmentResult(parseStructuredLabResult(report.result_json));
                          setAmendmentReason('');
                          setAmendmentFile(null);
                        }}
                      >
                        Create amendment
                      </Button>
                    )}
                  </div>
                </div>
                {amendmentReportId === report.report_id && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
                    <p className="font-medium">Create corrected version</p>
                    <p className="mt-1 text-xs text-muted-foreground">The original remains current until this version is independently verified and published.</p>
                    <div className="mt-4"><LabResultEditor value={amendmentResult} onChange={setAmendmentResult} /></div>
                    <label className="mt-4 block text-sm font-medium">
                      Amendment reason
                      <textarea value={amendmentReason} onChange={(e) => setAmendmentReason(e.target.value)} placeholder="Explain exactly what was corrected and why." className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm dark:border-white/10 dark:bg-surface-dark-muted" />
                    </label>
                    <label className="mt-4 block text-sm font-medium">
                      Replacement report document {report.file_id ? '(required because the current report has a document)' : '(optional)'}
                      <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={(e) => setAmendmentFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" />
                    </label>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setAmendmentReportId(null)}>Cancel</Button>
                      <Button size="sm" loading={amendReport.isPending} disabled={amendmentReason.trim().length < 5 || (report.file_id ? !amendmentFile : false)} onClick={submitAmendment}>Create corrected version</Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!reportArchive?.length && <div className="p-8 text-sm text-slate-500">No current reports or pending amendments require review.</div>}
          </div>
        </Card>
      )}

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
                              setReportResult(createEmptyLabResult());
                              setReportFile(null);
                            }}
                          >
                            Create report
                          </Button>
                        )}
                        {item.report_id && item.report_status === 'completed' && (
                          <Button
                            size="sm"
                            loading={verify.isPending}
                            disabled={!!item.report_authored_by && item.report_authored_by === profile?.id}
                            onClick={() => verify.mutate({ reportId: item.report_id! })}
                          >
                            {item.report_authored_by === profile?.id ? 'Awaiting independent reviewer' : 'Verify'}
                          </Button>
                        )}
                        {item.report_id && item.report_status === 'verified' && (
                          <Button size="sm" variant="success" loading={deliver.isPending} onClick={() => deliver.mutate({ reportId: item.report_id! })}>
                            Publish
                          </Button>
                        )}
                        {item.report_file_id && item.report_id && (
                          <Button size="sm" variant="secondary" onClick={() => void openDocument(item.report_id!)}>
                            Open document
                          </Button>
                        )}
                        {item.report_status === 'delivered' && <Badge tone="success">Published to EHR</Badge>}
                      </div>
                    </div>

                    {reportingItem === item.id && (
                      <div className="mt-4 rounded-xl border border-brand-200 bg-white p-4 dark:border-brand-900 dark:bg-surface-dark-soft">
                        <LabResultEditor value={reportResult} onChange={setReportResult} />
                        <label className="mt-3 block text-sm font-medium text-foreground" htmlFor={'lab-report-file-' + item.id}>
                          Attach report document <span className="font-normal text-muted-foreground">(optional · PDF/JPG/PNG · max 20 MB)</span>
                          <input
                            id={'lab-report-file-' + item.id}
                            type="file"
                            accept="application/pdf,image/jpeg,image/png"
                            onChange={(e) => setReportFile(e.target.files?.[0] ?? null)}
                            className="mt-2 block w-full text-sm"
                          />
                        </label>
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
