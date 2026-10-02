import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader, Skeleton, EmptyState } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { formatDateTime } from '@/lib/utils';
import { useMyMedicalRecords, useMyLabReports, useMyPrescriptions } from '@/hooks/queries/useEhrQueries';
import { useRef } from 'react';
import { useReveal } from '@/lib/gsap';
import { IoDocumentTextOutline, IoMedkitOutline, IoFlaskOutline } from 'react-icons/io5';

export function MedicalRecords() {
  const { data: records, isLoading: loadingRecords } = useMyMedicalRecords();
  const { data: labReports, isLoading: loadingLabs } = useMyLabReports();
  const { data: prescriptions, isLoading: loadingPrescriptions } = useMyPrescriptions();
  const rootRef = useRef<HTMLDivElement>(null);
  useReveal(rootRef);

  return (
    <PageTransition>
      <div ref={rootRef} className="space-y-6">
        <PageHeader 
          title="My Health Profile" 
          subtitle="Access your medical records, lab reports, and prescriptions securely." 
        />

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
                    {p.items?.map((item) => (
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
                <div key={report.id} className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 p-4">
                  <div>
                    <p className="font-medium text-sm">{report.test_name ?? report.report_code}</p>
                    <p className="text-xs text-slate-500">{formatDateTime(report.created_at)}</p>
                  </div>
                  <Badge tone={report.status === 'completed' ? 'success' : 'warning'}>{report.status}</Badge>
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
