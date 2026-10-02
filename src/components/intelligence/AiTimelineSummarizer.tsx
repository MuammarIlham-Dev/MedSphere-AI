import { useTimelineSummarizer } from'@/hooks/queries/useAiQueries';
import { Card, CardHeader } from'@/components/ui/Card';
import { Skeleton, EmptyState } from'@/components/ui/KpiCard';
import ReactMarkdown from'react-markdown';

export function AiTimelineSummarizer({ records }: { records: unknown[] }) {
 const { data, isLoading, error } = useTimelineSummarizer(records, records.length > 0);

 if (records.length === 0) {
 return (
 <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
 <EmptyState title="No records to summarize" hint="Add patient history to generate an AI summary." />
 </Card>
 );
 }

 return (
 <Card className="bg-brand-50/50 dark:bg-brand-950/20 border-brand-100 dark:border-brand-900">
 <CardHeader 
 title="AI Medical Summary" 
 subtitle="Auto-generated timeline of patient history"
 
 />
 <div className="p-5 pt-0">
 {isLoading && (
 <div className="space-y-2">
 <Skeleton className="h-4 w-full" />
 <Skeleton className="h-4 w-5/6" />
 <Skeleton className="h-4 w-4/6" />
 </div>
 )}
 
 {error && (
 <p className="text-sm text-danger-600 dark:text-danger-400">Failed to generate summary.</p>
 )}
 
 {data && (
 <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
 <ReactMarkdown>{data.summary}</ReactMarkdown>
 </div>
 )}
 </div>
 </Card>
 );
}
