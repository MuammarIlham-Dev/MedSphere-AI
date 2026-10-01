import { cn } from '@/lib/utils';
export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
  );
}

export function FullPageLoader() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center" role="status" aria-label="Loading">
      <Spinner className="h-8 w-8 text-brand-600" />
    </div>
  );
}
