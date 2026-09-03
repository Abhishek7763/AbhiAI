export default function Loading() {
  return (
    <main className="min-h-screen bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl gap-4 px-4 py-4 sm:px-6">
        <aside className="hidden w-64 shrink-0 rounded-3xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70 md:block">
          <div className="h-10 w-32 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-8 space-y-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-9 animate-pulse rounded-xl bg-zinc-200/80 dark:bg-zinc-800/80" />
            ))}
          </div>
        </aside>
        <section className="flex min-w-0 flex-1 flex-col rounded-3xl border border-zinc-200 bg-white/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/70 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="h-9 w-28 animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-9 w-9 animate-pulse rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="w-full max-w-2xl space-y-4">
              <div className="h-14 w-3/4 animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
              <div className="ml-auto h-20 w-2/3 animate-pulse rounded-2xl bg-zinc-200/60 dark:bg-zinc-800/60" />
              <div className="h-24 w-4/5 animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
            </div>
          </div>
          <div className="h-14 animate-pulse rounded-2xl bg-zinc-200/80 dark:bg-zinc-800/80" />
        </section>
      </div>
    </main>
  );
}
