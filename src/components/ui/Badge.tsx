import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';
type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';
const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-600 dark:bg-surface-dark-muted dark:text-slate-300',
  brand: 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300',
  success: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300',
  warning: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  danger: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300',
  info: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
};

export function Badge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>
      {children}
    </span>
  );
}
