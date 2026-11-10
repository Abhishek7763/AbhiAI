import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50 flex items-center justify-center px-6 py-12">
      <section className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white/90 p-8 text-center shadow-xl dark:border-zinc-800 dark:bg-zinc-900/90">
        <p className="text-sm font-semibold tracking-[0.28em] text-zinc-400">404</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          The AbhiAI page you opened does not exist or may have moved.
        </p>
        <Link
          href="/"
          className="mt-7 inline-flex min-h-11 items-center justify-center rounded-xl bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
        >
          Back to AbhiAI
        </Link>
      </section>
    </main>
  );
}
