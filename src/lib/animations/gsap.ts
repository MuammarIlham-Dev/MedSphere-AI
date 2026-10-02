import { useLayoutEffect, useRef } from 'react';

export function usePopReveal(delay = 0) {
  const ref = useRef<any>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        scale: 0.95,
        opacity: 0,
        duration: 0.5,
        delay,
        ease: 'back.out(1.5)',
      });
    }, ref);

    return () => ctx.revert();
  }, [delay]);

  return ref;
}

export function useHoverLift() {
  const ref = useRef<any>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    let hoverTween: gsap.core.Tween;

    const onEnter = () => {
      hoverTween = gsap.to(el, {
        y: -4,
        boxShadow: '0 10px 40px -10px rgba(12, 74, 110, 0.15)',
        duration: 0.3,
        ease: 'power2.out',
      });
    };

    const onLeave = () => {
      if (hoverTween) hoverTween.kill();
      gsap.to(el, {
        y: 0,
        boxShadow: '0 10px 40px -10px rgba(12, 74, 110, 0.08)',
        duration: 0.4,
        ease: 'power2.out',
      });
    };

    el.addEventListener('mouseenter', onEnter);
    el.addEventListener('mouseleave', onLeave);

    return () => {
      el.removeEventListener('mouseenter', onEnter);
      el.removeEventListener('mouseleave', onLeave);
      if (hoverTween) hoverTween.kill();
    };
  }, []);

  return ref;
}
