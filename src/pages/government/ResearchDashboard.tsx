import { Select } from '@/components/ui/Input';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { researchService } from '@/services/research.service';
import { KpiCard, PageHeader, EmptyState, Skeleton } from '@/components/ui/KpiCard';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { ChartCard } from '@/components/charts/ChartCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { ResearchAiInsights, DataExportPanel } from '@/components/research/ResearchInsights';
import { useUiStore } from '@/stores/uiStore';
import {
  IoFlaskOutline, IoSearchOutline, IoShieldCheckmarkOutline,
  IoDocumentTextOutline, IoPeopleOutline, IoStatsChartOutline
} from 'react-icons/io5';

export default function ResearchDashboard() {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);  // Ethics Proposals state
  const [newTitle, setNewTitle] = useState('');
  const [newPurpose, setNewPurpose] = useState('');

  const { data: studies, isLoading: loadingStudies } = useQuery({
    queryKey: ['research-studies'],
    queryFn: () => researchService.getMyStudies()
  });

  const submitMutation = useMutation({
    mutationFn: () => researchService.submitStudy(newTitle, newPurpose),
    onSuccess: () => {
      setNewTitle('');
      setNewPurpose('');
      toast('success', 'Study proposal submitted for ethics review.');
      void qc.invalidateQueries({ queryKey: ['research-studies'] });
    },
    onError: (err: Error) => { toast('error', err.message); }
  });

  // Cohort Explorer state
  const [selectedStudy, setSelectedStudy] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState('');
  const [diagnosisFilter, setDiagnosisFilter] = useState('');
  const [activeQuery, setActiveQuery] = useState<{ studyId: string; region: string; diagnosis: string } | null>(null);

  const { data: cohortData, isLoading: loadingCohort } = useQuery({
    queryKey: ['cohort-stats', activeQuery],
    queryFn: () => {
      if (!activeQuery) return Promise.resolve([]);
      return researchService.getCohortStats(activeQuery.studyId, activeQuery.region, activeQuery.diagnosis);
    },
    enabled: !!activeQuery
  });

  const handleRunQuery = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedStudy) {
      toast('error', 'You must select an approved study to query data.');
      return;
    }
    setActiveQuery({ studyId: selectedStudy, region: regionFilter, diagnosis: diagnosisFilter });
  };

  const approvedStudies = studies?.filter(s => s.status === 'approved') || [];
  const selectedStudyTitle = approvedStudies.find(s => s.id === selectedStudy)?.title;

  // KPI summaries
  const totalStudies = studies?.length ?? 0;
  const approvedCount = approvedStudies.length;
  const pendingCount = studies?.filter(s => s.status === 'pending').length ?? 0;

  return (
    <PageTransition>
      <div className="space-y-6">
        <PageHeader
          title="Research & Intelligence Hub"
          subtitle="Anonymized cohort explorer, ethics workflow, and AI-powered insights"
        />

        {/* KPI strip */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Total studies" value={totalStudies} icon={<IoDocumentTextOutline className="h-5 w-5" />} />
          <KpiCard label="Approved" value={approvedCount} icon={<IoFlaskOutline className="h-5 w-5" />} />
          <KpiCard label="Pending review" value={pendingCount} icon={<IoStatsChartOutline className="h-5 w-5" />} />
          <KpiCard label="Cohort records" value={cohortData?.length ?? 0} icon={<IoPeopleOutline className="h-5 w-5" />} />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Ethics Proposals Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <CardHeader title="Submit Study Proposal" subtitle="Requires Ethics Committee approval" />
              <form
                className="p-5 space-y-4"
                onSubmit={(e) => { e.preventDefault(); submitMutation.mutate(); }}
              >
                <div>
                  <label className="block text-sm font-medium mb-1">Study Title</label>
                  <Input value={newTitle} onChange={e => { setNewTitle(e.target.value); }} required placeholder="e.g. Asthma Trends" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Purpose & Ethics Statement</label>
                  <textarea
                    className="w-full rounded-xl border border-border bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900"
                    rows={3} required
                    value={newPurpose} onChange={e => { setNewPurpose(e.target.value); }}
                    placeholder="Describe how data will be used safely..."
                  />
                </div>
                <Button type="submit" disabled={submitMutation.isPending || !newTitle || !newPurpose} className="w-full">
                  Submit Proposal
                </Button>
              </form>
            </Card>

            <Card>
              <CardHeader title="My Studies" />
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {loadingStudies && <li className="p-5"><Skeleton className="h-10 w-full" /></li>}
                {!loadingStudies && studies?.length === 0 && (
                  <li className="p-5"><EmptyState title="No studies yet" /></li>
                )}
                {studies?.map(study => (
                  <li key={study.id} className="p-4 flex flex-col gap-2">
                    <div className="flex justify-between items-start">
                      <span className="font-medium text-sm">{study.title}</span>
                      <Badge tone={study.status === 'approved' ? 'success' : study.status === 'rejected' ? 'danger' : 'warning'}>
                        {study.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{study.purpose}</p>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Data Export */}
            <DataExportPanel cohortData={cohortData} studyTitle={selectedStudyTitle} />
          </div>

          {/* Cohort Explorer Main Area */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader
                title="Cohort Explorer"
                subtitle="k-anonymous aggregate query engine — minimum cohort size 5"
                action={<IoShieldCheckmarkOutline className="w-6 h-6 text-emerald-500" title="Privacy Enforced" />}
              />
              <div className="p-5 border-b border-slate-100 dark:border-white/5">
                <form className="flex flex-col sm:flex-row gap-4 items-end" onSubmit={handleRunQuery}>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Select Approved Study</label>
                    <select
                      className="w-full h-10 rounded-xl border border-border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900"
                      value={selectedStudy} onChange={e => { setSelectedStudy(e.target.value); }} required
                    >
                      <option value="">-- Select Study --</option>
                      {approvedStudies.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Region (authorized scope)</label>
                    <Input value={regionFilter} onChange={e => { setRegionFilter(e.target.value); }} placeholder="Assigned study region" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium mb-1">Diagnosis (Optional)</label>
                    <Input value={diagnosisFilter} onChange={e => { setDiagnosisFilter(e.target.value); }} placeholder="e.g. Asthma" />
                  </div>
                  <Button type="submit" disabled={!selectedStudy}>
                    <IoSearchOutline className="mr-2" /> Query
                  </Button>
                </form>
              </div>

              <div className="p-5 min-h-[300px]">
                {!activeQuery && (
                  <EmptyState title="Run a query" hint="Select an approved study to explore anonymized data." action={<IoFlaskOutline className="w-12 h-12 text-slate-300" />} />
                )}
                {activeQuery && loadingCohort && (
                  <div className="flex justify-center items-center h-40"><Skeleton className="h-32 w-full max-w-md" /></div>
                )}
                {activeQuery && !loadingCohort && (!cohortData || cohortData.length === 0) && (
                  <EmptyState title="No results or suppressed" hint="Groups smaller than 5 distinct patients are suppressed. Results are limited to the study and residency scope authorized by the server." />
                )}
                {activeQuery && cohortData && cohortData.length > 0 && (
                  <div className="space-y-6">
                    <ChartCard
                      title={`Results for ${activeQuery.diagnosis || 'All'} in ${activeQuery.region || 'All Regions'}`}
                      subtitle="k-anonymity threshold >= 5 strictly enforced"
                      config={{
                        type: 'bar',
                        data: {
                          labels: cohortData.map(c => `${c.region_id} - ${c.diagnosis}`),
                          datasets: [{
                            label: 'Patient Count',
                            data: cohortData.map(c => c.patient_count),
                            backgroundColor: 'rgba(14, 116, 144, 0.5)',
                            borderColor: 'rgb(14, 116, 144)',
                            borderWidth: 1
                          }]
                        }
                      }}
                    />
                    {/* Population distribution pie */}
                    <ChartCard
                      title="Population distribution"
                      subtitle="Relative proportion by region-diagnosis group"
                      height={240}
                      config={{
                        type: 'doughnut',
                        data: {
                          labels: cohortData.map(c => `${c.region_id} · ${c.diagnosis}`),
                          datasets: [{
                            data: cohortData.map(c => c.patient_count),
                            backgroundColor: cohortData.map((_, i) => {
                              const colors = [
                                'rgba(14,165,233,0.7)', 'rgba(168,85,247,0.7)', 'rgba(239,68,68,0.7)',
                                'rgba(34,197,94,0.7)', 'rgba(245,158,11,0.7)', 'rgba(6,182,212,0.7)',
                                'rgba(236,72,153,0.7)', 'rgba(99,102,241,0.7)', 'rgba(234,179,8,0.7)',
                              ];
                              return colors[i % colors.length];
                            }),
                            borderWidth: 2,
                          }],
                        },
                        options: { cutout: '50%' } as unknown as import('chart.js').ChartOptions,
                      }}
                    />
                  </div>
                )}
              </div>
            </Card>

            {/* AI Research Insights */}
            <ResearchAiInsights cohortData={cohortData} />
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
