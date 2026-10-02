import { cn } from '@/lib/utils';
import type { HTMLAttributes, ReactNode } from 'react';

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-slate-200/70 bg-surface shadow-card',
        'dark:border-white/10 dark:bg-surface-dark-soft',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-white/5">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
