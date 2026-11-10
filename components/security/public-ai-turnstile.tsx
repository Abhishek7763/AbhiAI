'use client';

import { useEffect, useRef } from 'react';

type TurnstileApi = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const PROTECTED_PATHS = new Set(['/api/chat', '/api/chat/stream', '/api/generate-image']);
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() || '';

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

export function PublicAiTurnstile() {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const tokenRef = useRef('');
  const initErrorRef = useRef<Error | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return;

    let cancelled = false;
    let restoreFetch: (() => void) | null = null;

    const waitForToken = async () => {
      for (let attempt = 0; attempt < 240; attempt += 1) {
        if (tokenRef.current) return tokenRef.current;
        if (initErrorRef.current) throw initErrorRef.current;
        if (cancelled) throw new Error('Security verification was cancelled.');
        await delay(250);
      }
      throw new Error('Security verification timed out. Please refresh and try again.');
    };

    const originalFetch = window.fetch.bind(window);
    const protectedFetch: typeof window.fetch = async (input, init) => {
      const rawUrl = input instanceof Request
        ? input.url
        : input instanceof URL
          ? input.href
          : String(input);
      const url = new URL(rawUrl, window.location.href);
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

      if (url.origin !== window.location.origin || method !== 'POST' || !PROTECTED_PATHS.has(url.pathname)) {
        return originalFetch(input, init);
      }

      const token = await waitForToken();
      const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
      headers.set('x-turnstile-token', token);

      try {
        return await originalFetch(input, { ...init, headers });
      } finally {
        tokenRef.current = '';
        if (window.turnstile && widgetIdRef.current) {
          window.turnstile.reset(widgetIdRef.current);
        }
      }
    };

    window.fetch = protectedFetch;
    restoreFetch = () => {
      if (window.fetch === protectedFetch) window.fetch = originalFetch;
    };

    const loadTurnstile = async () => {
      if (window.turnstile) return;

      await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>('script[data-abhiai-turnstile="true"]');
        if (existing) {
          if (window.turnstile) {
            resolve();
            return;
          }
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Security verification script failed to load.')), { once: true });
          return;
        }

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        script.dataset.abhiaiTurnstile = 'true';
        script.addEventListener('load', () => resolve(), { once: true });
        script.addEventListener('error', () => reject(new Error('Security verification script failed to load.')), { once: true });
        document.head.appendChild(script);
      });
    };

    void (async () => {
      try {
        await loadTurnstile();
        if (cancelled || !window.turnstile || !containerRef.current) return;

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          action: 'public-ai',
          appearance: 'interaction-only',
          theme: 'auto',
          retry: 'auto',
          callback: (token: string) => {
            tokenRef.current = token;
          },
          'expired-callback': () => {
            tokenRef.current = '';
          },
          'error-callback': () => {
            tokenRef.current = '';
            return true;
          },
          'timeout-callback': () => {
            tokenRef.current = '';
            if (window.turnstile && widgetIdRef.current) {
              window.turnstile.reset(widgetIdRef.current);
            }
          },
        });
      } catch (error) {
        initErrorRef.current = error instanceof Error
          ? error
          : new Error('Security verification could not initialize.');
        console.warn('AbhiAI bot protection could not initialize.', error);
      }
    })();

    return () => {
      cancelled = true;
      restoreFetch?.();
      if (window.turnstile && widgetIdRef.current) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      tokenRef.current = '';
      initErrorRef.current = null;
    };
  }, []);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className="fixed bottom-3 right-3 z-[100] min-h-px" />;
}
