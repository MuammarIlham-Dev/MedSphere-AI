import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader, Skeleton, EmptyState } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { formatDateTime } from '@/lib/utils';
import { useMyMedicalRecords, useMyLabReports, useMyPrescriptions, useLabReportHistory } from '@/hooks/queries/useEhrQueries';
import { LabResultView } from '@/components/laboratory/LabResultView';
import { parseStructuredLabResult } from '@/types/laboratory';
import { MedicationReminderPanel } from '@/components/ehr/MedicationReminderPanel';
import { PrescriptionSharingPanel } from '@/components/ehr/PrescriptionSharingPanel';
import { useRef, useState } from 'react';
import { useReveal } from '@/lib/gsap';
import { IoDocumentTextOutline, IoMedkitOutline, IoFlaskOutline } from 'react-icons/io5';
import { Button } from '@/components/ui/Button';
import { ehrService } from '@/services/ehr.service';
import { useQuery } from '@tanstack/react-query';

export function MedicalRecords() {
  const { data: records, isLoading: loadingRecords } = useMyMedicalRecords();
  const { data: labReports, isLoading: loadingLabs } = useMyLabReports();
  const { data: prescriptions, isLoading: loadingPrescriptions } = useMyPrescriptions();
  const [historyReportId, setHistoryReportId] = useState<string | null>(null);
  const [versionHistoryReportId, setVersionHistoryReportId] = useState<string | null>(null);
  const versionHistory = useLabReportHistory(versionHistoryReportId);
  const history = useQuery({
    queryKey: ['lab-report-access-history', historyReportId],
    queryFn: () => ehrService.labReportAccessHistory(historyReportId!),
    enabled: !!historyReportId,
  });
  const openReport = async (reportId: string) => {
    const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');
    try {
      const url = await ehrService.openLabReportDocument(reportId);
      if (popup) popup.location.href = url;
      else window.location.assign(url);
    } catch (error) {
      popup?.close();
      window.alert(error instanceof Error ? error.message : 'Could not open laboratory document');
    }
  };
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  return (
    <PageTransition>
      <div ref={rootRef} className="space-y-6">
        <PageHeader 
          title="My Health Profile" 
          subtitle="Access your medical records, lab reports, and prescriptions securely." 
        />

        <MedicationReminderPanel />
        <PrescriptionSharingPanel />

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Prescriptions Section */}
          <Card className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <IoMedkitOutline className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">Active Prescriptions</h2>
            </div>
            
            <div className="flex flex-col gap-3">
              {loadingPrescriptions && <Skeleton className="h-20 w-full" />}
              {!loadingPrescriptions && prescriptions?.length === 0 && (
                <EmptyState title="No prescriptions" hint="You don't have any recent prescriptions." />
              )}
              {prescriptions?.map((p) => (
                <div key={p.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-sm">Dr. {p.doctor?.full_name}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(p.created_at)}</p>
                    </div>
                    <Badge tone={p.status === 'active' ? 'success' : 'neutral'}>{p.status}</Badge>
                  </div>
                  <ul className="mt-3 space-y-2">
                    {p.items?.map((item: any) => (
                      <li key={item.id} className="flex justify-between text-sm">
                        <span className="font-medium">{item.medicine?.name}</span>
                        <span className="text-slate-500 text-xs text-right">
                          {item.dosage} · {item.frequency} <br/> ({item.duration_days} days)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>

          {/* Lab Reports Section */}
          <Card className="p-5 flex flex-col gap-4">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                <IoFlaskOutline className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">Lab Reports</h2>
            </div>
            
            <div className="flex flex-col gap-3">
              {loadingLabs && <Skeleton className="h-16 w-full" />}
              {!loadingLabs && labReports?.length === 0 && (
                <EmptyState title="No lab reports" hint="You don't have any recent lab results." />
              )}
              {labReports?.map((report) => (
                <div key={report.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-sm">{report.test_name ?? report.report_code}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(report.created_at)}</p>
                    </div>
                    <Badge tone={report.version_no > 1 ? 'warning' : 'success'}>
                      {report.version_no > 1 ? 'Corrected v' + report.version_no : report.status}
                    </Badge>
                  </div>
                  <div className="mt-3">
                    <LabResultView result={parseStructuredLabResult(report.result_json)} />
                    {report.amendment_reason && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300"><span className="font-medium">Correction reason:</span> {report.amendment_reason}</p>}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.file_id && <Button size="sm" onClick={() => void openReport(report.id)}>Open report document</Button>}
                    <Button size="sm" variant="ghost" onClick={() => setHistoryReportId(historyReportId === report.id ? null : report.id)}>
                      {historyReportId === report.id ? 'Hide access history' : 'Access history'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setVersionHistoryReportId(versionHistoryReportId === report.id ? null : report.id)}>
                      {versionHistoryReportId === report.id ? 'Hide version history' : 'Version history'}
                    </Button>
                  </div>
                  {versionHistoryReportId === report.id && (
                    <div className="mt-3 space-y-2 rounded-lg bg-surface-muted p-3 dark:bg-surface-dark-muted">
                      {versionHistory.isLoading && <p className="text-xs text-slate-500">Loading report versions…</p>}
                      {!versionHistory.isLoading && versionHistory.data?.map((version) => (
                        <div key={version.report_id} className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 py-2 text-xs last:border-0 dark:border-white/10">
                          <div>
                            <span className="font-medium">Version {version.version_no}</span>
                            <span className="ml-2 capitalize text-slate-500">{version.status}</span>
                            {version.is_current && <span className="ml-2 font-medium text-success-600">Current</span>}
                            {version.amendment_reason && <p className="mt-1 text-slate-500">{version.amendment_reason}</p>}
                          </div>
                          <span className="text-slate-500">{formatDateTime(version.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {historyReportId === report.id && (
                    <div className="mt-3 rounded-lg bg-surface-muted p-3 dark:bg-surface-dark-muted">
                      {history.isLoading && <p className="text-xs text-slate-500">Loading access history…</p>}
                      {!history.isLoading && history.data?.length === 0 && <p className="text-xs text-slate-500">No document opens recorded yet.</p>}
                      {history.data?.map((entry, index) => (
                        <div key={entry.accessed_at + ':' + index} className="flex flex-wrap justify-between gap-2 border-b border-slate-200 py-2 text-xs last:border-0 dark:border-white/10">
                          <span>{entry.accessor_name} · {entry.accessor_role.replace('_', ' ')}</span>
                          <span className="text-slate-500">{formatDateTime(entry.accessed_at)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Medical Records Section */}
          <Card className="p-5 flex flex-col gap-4 lg:col-span-2">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-white/5 pb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                <IoDocumentTextOutline className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">Consultation History & Documents</h2>
            </div>
            
            <div className="flex flex-col gap-3">
              {loadingRecords && <Skeleton className="h-20 w-full" />}
              {!loadingRecords && records?.length === 0 && (
                <EmptyState title="No records" hint="Your consultation history will appear here." />
              )}
              {records?.map((record) => (
                <div key={record.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
                  <div className="flex justify-between items-start">
                    <h3 className="font-semibold text-sm">{record.title}</h3>
                    <p className="text-xs text-slate-500">{formatDateTime(record.created_at)}</p>
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 text-sm text-slate-600 dark:text-slate-400">
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-200">Diagnosis</p>
                      <p>{record.diagnosis || 'None'}</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-slate-200">Notes</p>
                      <p>{record.notes || 'None'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </PageTransition>
  );
}

export default MedicalRecords;
