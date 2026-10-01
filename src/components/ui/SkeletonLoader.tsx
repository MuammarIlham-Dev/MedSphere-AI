import { cn } from '@/lib/utils';
import type { HTMLAttributes } from 'react';

export function SkeletonLoader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-2xl bg-gradient-to-r from-brand-100 via-brand-200 to-brand-100 bg-[length:200%_100%] shadow-soft',
        className
      )}
      style={{
        animation: 'shimmer 2s infinite linear',
      }}
      {...props}
    />
  );
}
