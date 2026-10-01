import { useRef, useEffect } from 'react';
import { env } from '@/lib/env';
declare global { interface Window { turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id: string) => void } } }

const SCRIPT_ID = 'cf-turnstile';

export function Turnstile({ onVerify }: { onVerify: (token: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!env.turnstileSiteKey) return; // local dev without Turnstile
    const render = () => {
      if (containerRef.current && window.turnstile && !containerRef.current.dataset.rendered) {
        containerRef.current.dataset.rendered = '1';
        window.turnstile.render(containerRef.current, {
          sitekey: env.turnstileSiteKey,
          callback: onVerify,
          theme: document.documentElement.classList.contains('dark') ? 'dark' : 'light',
        });
      }
    };
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      s.async = true;
      s.onload = render;
      document.head.appendChild(s);
    } else render();
  }, [onVerify]);

  if (!env.turnstileSiteKey) return null;
  return <div ref={containerRef} className="my-2" />;
}
