import Link from 'next/link';
import { Cpu, Route, ArrowRight } from 'lucide-react';

export default function ModelsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-2xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center">
            <Cpu className="w-5 h-5" />
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Models</h1>
        </div>
        <p className="text-sm sm:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
          View and manage the AI models available to AbhiAI. Model synchronization and routing controls will be connected in the upcoming provider phase.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
          <Route className="w-5 h-5 mb-4 text-zinc-500" />
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Model source</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Current model discovery tools remain under AI Connections until the dedicated model registry is wired here.
          </p>
          <Link
            href="/admin/connections"
            className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100"
          >
            Open AI Connections <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/60 dark:bg-zinc-900/50 p-5 sm:p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Phase 4 shell</div>
          <h2 className="mt-3 font-semibold text-zinc-900 dark:text-zinc-100">Model workspace ready</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Enabled state, provider mapping, capabilities, health and routing priority can be layered onto this route without changing the admin shell.
          </p>
        </div>
      </div>
    </div>
  );
}
