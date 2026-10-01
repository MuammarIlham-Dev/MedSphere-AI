import { Card, CardHeader } from '@/components/ui/Card';
import { useEffect, useRef } from 'react';
import { Chart, registerables, type ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

export function ChartCard({ title, subtitle, config, height = 260 }: {
  title: string; subtitle?: string; config: ChartConfiguration; height?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const isDark = document.documentElement.classList.contains('dark');
    const grid = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.12)';
    const ticks = isDark ? '#94a3b8' : '#64748b';
    chartRef.current?.destroy();
    chartRef.current = new Chart(canvasRef.current, {
      ...config,
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: ticks, boxWidth: 12 } }, ...config.options?.plugins },
        scales: config.type === 'doughnut' ? undefined : {
          x: { grid: { color: grid }, ticks: { color: ticks }, ...config.options?.scales?.x },
          y: { grid: { color: grid }, ticks: { color: ticks }, ...config.options?.scales?.y },
        },
        ...config.options,
      },
    });
    return () => chartRef.current?.destroy();
  }, [config]);

  return (
    <Card data-reveal>
      <CardHeader title={title} subtitle={subtitle} />
      <div className="p-5" style={{ height }}>
        <canvas ref={canvasRef} aria-label={title} role="img" />
      </div>
    </Card>
  );
}
