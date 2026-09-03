'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Application error boundary caught an error.', error);
  }, [error]);

  return (
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white/90 p-8 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900/90">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-2xl dark:bg-zinc-800">⚠️</div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">AbhiAI</p>
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          AbhiAI hit an unexpected problem. Your current browser data has not been intentionally cleared.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
