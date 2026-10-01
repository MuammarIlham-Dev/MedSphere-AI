import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface FilterChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
}

export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ active, className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-300',
          active
            ? 'bg-brand-700 text-white shadow-soft'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800',
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

FilterChip.displayName = 'FilterChip';
