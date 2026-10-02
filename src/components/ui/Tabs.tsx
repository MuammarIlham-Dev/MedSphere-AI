import { cn } from '@/lib/utils';
export function Tabs<T extends string>({ tabs, active, onChange }: {
  tabs: Array<{ id: T; label: string }>; active: T; onChange: (id: T) => void;
}) {
  return (
    <div role="tablist" className="inline-flex rounded-xl bg-surface-muted p-1 dark:bg-surface-dark-muted">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={active === t.id} onClick={() => onChange(t.id)}
          className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-colors',
            active === t.id
              ? 'bg-surface text-slate-900 shadow-sm dark:bg-surface-dark-soft dark:text-white'
              : 'text-slate-500 hover:text-slate-700 dark:text-slate-400')}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
