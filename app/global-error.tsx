'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Root layout error boundary caught an error.', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#09090b', color: '#fafafa', fontFamily: 'system-ui, sans-serif' }}>
        <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 24, boxSizing: 'border-box' }}>
          <section style={{ width: '100%', maxWidth: 520, border: '1px solid #27272a', borderRadius: 24, padding: 32, textAlign: 'center', background: '#18181b' }}>
            <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <p style={{ margin: '0 0 8px', color: '#a1a1aa', fontSize: 12, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' }}>AbhiAI</p>
            <h1 style={{ margin: 0, fontSize: 26 }}>AbhiAI needs a retry</h1>
            <p style={{ margin: '14px 0 0', color: '#a1a1aa', lineHeight: 1.6, fontSize: 14 }}>
              A core application error occurred. Retry the page; if it happens again, the production error report can be inspected without exposing your API keys.
            </p>
            <button
              type="button"
              onClick={reset}
              style={{ marginTop: 24, minHeight: 44, border: 0, borderRadius: 12, padding: '10px 20px', background: '#fafafa', color: '#09090b', fontWeight: 700, cursor: 'pointer' }}
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  );
}
