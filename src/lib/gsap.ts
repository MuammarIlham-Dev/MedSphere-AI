const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';

export { gsap };

/** Fade-and-rise page entrance. Attach ref to the page root. */
export function usePageEnter<T extends HTMLElement>(ref: RefObject<T | null>) {
  useLayoutEffect(() => {
    if (!ref.current || isReducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(ref.current, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power2.out' });
    }, ref);
    return () => ctx.revert();
  }, [ref]);
}

/** Stagger-reveal children matching `selector` when they mount. */
export function useReveal<T extends HTMLElement>(ref: RefObject<T | null>, selector = '[data-reveal]') {
  useLayoutEffect(() => {
    if (!ref.current || isReducedMotion) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        selector,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out' },
      );
    }, ref);
    return () => ctx.revert();
  }, [ref, selector]);
}
