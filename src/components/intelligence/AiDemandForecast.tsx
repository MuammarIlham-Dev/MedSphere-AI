import { useDemandForecast } from'@/hooks/useAi';
import { Card, CardHeader } from'@/components/ui/Card';
import { Skeleton } from'@/components/ui/KpiCard';
import { Badge } from'@/components/ui/Badge';
import ReactMarkdown from'react-markdown';

export function AiDemandForecast({ historyData }: { historyData: unknown[] }) {
 const { data, isLoading, error } = useDemandForecast(historyData, historyData.length > 0);

 return (
 <Card className="bg-gradient-to-br from-white to-brand-50/30 dark:from-slate-900 dark:to-brand-950/20">
 <CardHeader 
 title="AI Demand Forecast" 
 subtitle="7-day prediction for critical resources"
 
 action={
 data?.confidence && (
 <Badge tone={data.confidence ==='High' ?'success' : data.confidence ==='Medium' ?'warning' :'danger'}>
 {data.confidence} Confidence
 </Badge>
 )
 }
 />
 <div className="p-5 pt-0">
 {isLoading && (
 <div className="space-y-2">
 <Skeleton className="h-4 w-full" />
 <Skeleton className="h-4 w-5/6" />
 </div>
 )}
 
 {error && (
 <p className="text-sm text-danger-600 dark:text-danger-400">Forecast unavailable.</p>
 )}
 
 {data && (
 <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
 <ReactMarkdown>{data.forecast}</ReactMarkdown>
 </div>
 )}
 </div>
 </Card>
 );
}
