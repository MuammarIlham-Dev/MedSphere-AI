import type { PropsWithChildren } from 'react';
import { useRef } from 'react';
import { usePageEnter } from '@/lib/gsap';
export function PageTransition({ children, className }: PropsWithChildren<{ className?: string }>) {
  const ref = useRef<HTMLDivElement>(null);
  usePageEnter(ref);
  return <div ref={ref} className={className}>{children}</div>;
}
