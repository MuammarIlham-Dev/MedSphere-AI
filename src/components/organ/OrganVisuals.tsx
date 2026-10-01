import { Card, CardHeader } from '@/components/ui/Card';
import { ChartCard } from '@/components/charts/ChartCard';
import { Badge } from '@/components/ui/Badge';
import { Skeleton, EmptyState } from '@/components/ui/KpiCard';
import { ORGAN_TYPES, type OrganStats } from '@/types';
import { IoBodyOutline } from 'react-icons/io5';

const ORGAN_COLORS: Record<string, string> = {
  kidney: 'rgba(14, 165, 233, 0.7)',
  liver: 'rgba(168, 85, 247, 0.7)',
  heart: 'rgba(239, 68, 68, 0.7)',
  lung: 'rgba(34, 197, 94, 0.7)',
  pancreas: 'rgba(245, 158, 11, 0.7)',
  cornea: 'rgba(6, 182, 212, 0.7)',
  bone_marrow: 'rgba(236, 72, 153, 0.7)',
};

const ORGAN_BORDERS: Record<string, string> = {
  kidney: 'rgb(14, 165, 233)',
  liver: 'rgb(168, 85, 247)',
  heart: 'rgb(239, 68, 68)',
  lung: 'rgb(34, 197, 94)',
  pancreas: 'rgb(245, 158, 11)',
  cornea: 'rgb(6, 182, 212)',
  bone_marrow: 'rgb(236, 72, 153)',
};

export function OrganWaitlistChart({ stats }: { stats: OrganStats | undefined }) {
  if (!stats) return <Card data-reveal><div className="p-5"><Skeleton className="h-64 w-full" /></div></Card>;

  const organs = stats.byOrgan.length > 0
    ? stats.byOrgan
    : ORGAN_TYPES.map((o) => ({ organ: o, waiting: 0 }));

  return (
    <ChartCard
      title="Waiting list by organ"
      subtitle={`${stats.waiting.toString()} recipients across ${(organs.filter((o) => o.waiting > 0).length).toString()} organ types`}
      height={280}
      config={{
        type: 'doughnut',
        data: {
          labels: organs.map((o) => o.organ.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())),
          datasets: [{
            data: organs.map((o) => o.waiting),
            backgroundColor: organs.map((o) => ORGAN_COLORS[o.organ] ?? 'rgba(100,116,139,0.5)'),
            borderColor: organs.map((o) => ORGAN_BORDERS[o.organ] ?? 'rgb(100,116,139)'),
            borderWidth: 2,
          }],
        },
        options: {
          cutout: '55%',
          plugins: {
            legend: { position: 'right', labels: { padding: 14, usePointStyle: true, pointStyle: 'circle' } },
          },
        } as unknown as import('chart.js').ChartOptions
      }}
    />
  );
}

export function OrganTransplantTimeline({ matches }: { matches: Array<{ id: string; organ: string; donor_name?: string; recipient_name?: string; status: string; compatibility_score: number; reviewed_at?: string | null }> }) {
  const timeline = matches
    .filter((m) => m.status === 'accepted' || m.status === 'transplanted')
    .sort((a, b) => (b.reviewed_at ?? '').localeCompare(a.reviewed_at ?? ''));

  if (timeline.length === 0) {
    return (
      <Card data-reveal>
        <CardHeader title="Transplant timeline" subtitle="Accepted & completed transplants" />
        <div className="p-5">
          <EmptyState title="No transplants yet" hint="Accepted matches will appear here as a timeline." />
        </div>
      </Card>
    );
  }

  return (
    <Card data-reveal>
      <CardHeader title="Transplant timeline" subtitle={`${timeline.length.toString()} events`} />
      <div className="max-h-80 overflow-y-auto p-5">
        <ol className="relative border-l-2 border-brand-200 dark:border-brand-800 ml-3">
          {timeline.map((m) => (
            <li key={m.id} className="mb-6 ml-6">
              <span className={`absolute -left-[9px] mt-1.5 flex h-4 w-4 items-center justify-center rounded-full ring-4 ring-white dark:ring-slate-900 ${
                m.status === 'transplanted' ? 'bg-success' : 'bg-brand-500'
              }`}>
                <IoBodyOutline className="h-2.5 w-2.5 text-white" />
              </span>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium capitalize">
                    {m.organ.replace('_', ' ')} — {m.donor_name ?? 'Donor'} → {m.recipient_name ?? 'Recipient'}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Score {m.compatibility_score}/100 · {m.reviewed_at ? new Date(m.reviewed_at).toLocaleDateString() : '—'}
                  </p>
                </div>
                <Badge tone={m.status === 'transplanted' ? 'success' : 'brand'}>{m.status}</Badge>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}

export function HlaCrossmatchPanel({ match }: { match: { hla_score: number; blood_compatible: boolean; distance_km?: number | null; compatibility_score: number; organ: string } }) {
  const hlaLoci = [
    { locus: 'HLA-A', match: Math.min(Math.round(match.hla_score / 6 * 2), 2), total: 2 },
    { locus: 'HLA-B', match: Math.min(Math.round(match.hla_score / 6 * 2), 2), total: 2 },
    { locus: 'HLA-DR', match: Math.min(match.hla_score % 3, 2), total: 2 },
  ];

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">HLA Crossmatch Analysis</p>
      <div className="grid grid-cols-3 gap-2">
        {hlaLoci.map((l) => (
          <div key={l.locus} className="rounded-xl border border-slate-200 p-3 text-center dark:border-white/10">
            <p className="text-[10px] font-medium text-slate-400">{l.locus}</p>
            <p className={`text-lg font-bold ${l.match === l.total ? 'text-success' : l.match > 0 ? 'text-warning' : 'text-danger'}`}>
              {l.match}/{l.total}
            </p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl bg-surface-muted p-2.5 dark:bg-surface-dark-muted">
          <span className="text-slate-400">Blood</span>
          <span className={`ml-1 font-bold ${match.blood_compatible ? 'text-success' : 'text-danger'}`}>
            {match.blood_compatible ? 'Compatible ✓' : 'Incompatible ✗'}
          </span>
        </div>
        <div className="rounded-xl bg-surface-muted p-2.5 dark:bg-surface-dark-muted">
          <span className="text-slate-400">Distance</span>
          <span className="ml-1 font-bold text-slate-700 dark:text-slate-200">
            {match.distance_km != null ? `${match.distance_km.toString()} km` : 'N/A'}
          </span>
        </div>
      </div>
    </div>
  );
}
