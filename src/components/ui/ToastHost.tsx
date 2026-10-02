import { cn } from '@/lib/utils';
import { IoCloseOutline } from 'react-icons/io5';
import { useUiStore } from '@/stores/uiStore';
import { IoMoon, IoSunny, IoCheckmarkCircle, IoAlertCircle, IoInformationCircle } from 'react-icons/io5';

export function ToastHost() {
  const { toasts, dismiss } = useUiStore();
  const icons = { success: IoCheckmarkCircle, error: IoAlertCircle, info: IoInformationCircle };
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-slate-200 bg-surface p-3.5 shadow-card dark:border-white/10 dark:bg-surface-dark-muted animate-fade-up">
            <Icon className={cn('mt-0.5 h-5 w-5 shrink-0',
              t.kind === 'success' && 'text-success', t.kind === 'error' && 'text-danger', t.kind === 'info' && 'text-info')} />
            <p className="flex-1 text-sm text-slate-700 dark:text-slate-200">{t.message}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-slate-400 hover:text-slate-600">
              <IoCloseOutline className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useUiStore();
  return (
    <button onClick={toggleTheme} aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-dark-muted">
      {theme === 'dark' ? <IoSunny className="h-5 w-5" /> : <IoMoon className="h-5 w-5" />}
    </button>
  );
}
