import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, EmptyState } from '@/components/ui/KpiCard';
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { IoSparklesOutline, IoDownloadOutline, IoShieldCheckmarkOutline } from 'react-icons/io5';
import type { CohortStat } from '@/services/research.service';

interface AiInsight {
  title: string;
  summary: string;
  confidence: number;
  tags: string[];
}

async function generateInsights(cohortData: CohortStat[]): Promise<AiInsight[]> {
  const response = await supabase.functions.invoke('ai-assistant', {
    body: { task: 'research_insights', payload: { cohort: cohortData } },
  });
  if (response.error) throw response.error;
  const data = response.data as unknown;
  if (!Array.isArray(data)) throw new Error('AI service returned an invalid response');

  return data.filter((item): item is AiInsight => {
    if (!item || typeof item !== 'object') return false;
    const obj = item as Record<string, unknown>;
    return typeof obj.title === 'string'
      && typeof obj.summary === 'string'
      && Number.isInteger(obj.confidence)
      && (obj.confidence as number) >= 0
      && (obj.confidence as number) <= 100
      && Array.isArray(obj.tags);
  }).slice(0, 4);
}

export function ResearchAiInsights({ cohortData }: { cohortData: CohortStat[] | undefined }) {
  const [insights, setInsights] = useState<AiInsight[]>([]);

  const analyze = useMutation({
    mutationFn: () => generateInsights(cohortData ?? []),
    onSuccess: setInsights,
  });

  if (!cohortData || cohortData.length === 0) {
    return (
      <Card data-reveal>
        <CardHeader title="AI Research Insights" subtitle="Powered by Gemini Flash" action={<IoSparklesOutline className="h-5 w-5 text-amber-500" />} />
        <div className="p-5">
          <EmptyState title="Run a cohort query first" hint="AI insights will be generated from your anonymized query results." />
        </div>
      </Card>
    );
  }

  return (
    <Card data-reveal>
      <CardHeader
        title="AI Research Insights"
        subtitle="Analysis of k-anonymous aggregate rows · no individual records sent"
        action={
          <div className="flex items-center gap-2">
            <Badge tone="success"><IoShieldCheckmarkOutline className="mr-1 inline h-3 w-3" />k-anon</Badge>
            <Button size="sm" variant="secondary" onClick={() => { analyze.mutate(); }} disabled={analyze.isPending}>
              <IoSparklesOutline className="mr-1.5 h-3.5 w-3.5" />
              {analyze.isPending ? 'Analyzing…' : 'Generate insights'}
            </Button>
          </div>
        }
      />
      <div className="p-5 space-y-4">
        {analyze.isPending && (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
        {analyze.error && (
          <p className="rounded-xl border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700 dark:border-danger-900 dark:bg-danger-950/30 dark:text-danger-300">
            {analyze.error instanceof Error ? analyze.error.message : 'AI analysis failed'}
          </p>
        )}
        {insights.length === 0 && !analyze.isPending && !analyze.error && (
          <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/50 p-4 text-center dark:border-amber-800 dark:bg-amber-950/30">
            <IoSparklesOutline className="mx-auto h-8 w-8 text-amber-400" />
            <p className="mt-2 text-sm font-medium text-amber-700 dark:text-amber-300">Click "Generate insights" to analyze your cohort data with AI</p>
            <p className="mt-1 text-xs text-amber-500">Only the displayed aggregate rows are sent for research insight generation.</p>
          </div>
        )}
        {insights.map((insight, i) => (
          <div key={i} className="rounded-xl border border-slate-200 p-4 transition-all hover:shadow-md dark:border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{insight.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{insight.summary}</p>
              </div>
              <Badge tone={insight.confidence >= 80 ? 'success' : insight.confidence >= 60 ? 'warning' : 'neutral'}>
                {insight.confidence}%
              </Badge>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {insight.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-brand-950 dark:text-brand-300">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function DataExportPanel({ cohortData, studyTitle }: { cohortData: CohortStat[] | undefined; studyTitle?: string }) {
  const exportCsv = () => {
    if (!cohortData || cohortData.length === 0) return;
    const headers = 'region_id,diagnosis,patient_count\n';
    const rows = cohortData.map((c) => `${c.region_id},${c.diagnosis},${c.patient_count.toString()}`).join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cohort_${studyTitle?.replace(/\s+/g, '_') ?? 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card data-reveal>
      <CardHeader title="Data Export" subtitle="Download anonymized results for offline analysis" />
      <div className="p-5 space-y-3">
        <div className="rounded-xl bg-surface-muted p-4 dark:bg-surface-dark-muted">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">{cohortData?.length ?? 0} cohort records</p>
              <p className="text-xs text-slate-400">k-anonymity threshold ≥ 5 enforced</p>
            </div>
            <Button size="sm" variant="secondary" onClick={exportCsv} disabled={!cohortData || cohortData.length === 0}>
              <IoDownloadOutline className="mr-1.5 h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>
        <p className="text-[10px] text-slate-400 italic">
          Exported data contains only the aggregate cohort rows shown in this interface. Individual patient records are not included.
        </p>
      </div>
    </Card>
  );
}
