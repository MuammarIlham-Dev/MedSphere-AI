import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
const tones: Record<Tone, string> = {
  neutral: 'bg-surface-subtle text-text-muted border border-border-subtle',
  brand: 'bg-brand-rose text-brand-700 border border-brand-100',
  success: 'bg-brand-700 text-white border border-brand-800 shadow-soft',
  warning: 'bg-amber-50 text-amber-800 border border-amber-200',
  danger: 'bg-brand-pulse-red text-white shadow-soft',
  info: 'bg-blue-50 text-blue-800 border border-blue-200',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone], className)}>
      {children}
    </span>
  );
}
