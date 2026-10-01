import { cn } from '@/lib/utils';
import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react';

const fieldCls =
  'w-full rounded-xl border border-brand-200 bg-white/60 backdrop-blur-md px-4 py-3 text-sm text-brand-900 placeholder:text-brand-400 transition-all duration-300 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 focus:shadow-glow focus:bg-white/90';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, id, className, ...props }, ref) => (
  <div className="space-y-1.5">
    {label && (
      <label htmlFor={id} className="text-xs font-semibold text-brand-700">{label}</label>
    )}
    <input ref={ref} id={id} aria-invalid={!!error} aria-describedby={error ? `${id ?? 'field'}-error` : undefined}
      className={cn(fieldCls, error && 'border-red-500 focus:border-red-500 focus:ring-red-500/30 focus:shadow-none', className)} {...props} />
    {error && <p id={`${id ?? 'field'}-error`} role="alert" className="text-xs text-red-500 font-medium">{error}</p>}
  </div>
));
Input.displayName = 'Input';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { label?: string; error?: string }>(
  ({ label, error, id, className, children, ...props }, ref) => (
    <div className="space-y-1.5">
      {label && <label htmlFor={id} className="text-xs font-semibold text-brand-700">{label}</label>}
      <select ref={ref} id={id} aria-invalid={!!error} className={cn(fieldCls, className)} {...props}>{children}</select>
      {error && <p role="alert" className="text-xs text-red-500 font-medium">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';
