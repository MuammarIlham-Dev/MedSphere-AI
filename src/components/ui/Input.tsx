import { cn } from '@/lib/utils';
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

const fieldCls =
  'w-full rounded-xl border border-slate-300 bg-surface px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-white/15 dark:bg-surface-dark-muted dark:text-white';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, id, className, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>
    )}
    <input ref={ref} id={id} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
      className={cn(fieldCls, error && 'border-danger focus:border-danger focus:ring-danger/30', className)} {...props} />
    {error && <p id={`${id}-error`} role="alert" className="text-xs text-danger">{error}</p>}
  </div>
));
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string; icon?: ReactNode }>(
  ({ label, error, icon, id, className, children, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</label>}
      <div className="relative">
        {icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            {icon}
          </div>
        )}
        <select 
          ref={ref} 
          id={id} 
          aria-invalid={!!error} 
          className={cn(fieldCls, "appearance-none pr-10", icon && "pl-10", className)} 
          {...props}
        >
          {children}
        </select>
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';
