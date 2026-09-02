'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Activity, Boxes, KeyRound, Plus, Route, ShieldCheck } from 'lucide-react';
import { AddProviderWizard } from '@/components/admin/add-provider-wizard';
import type { ProviderTemplate } from '@/lib/ai/providers/registry';

type ProviderRow = {
  id: string;
  slug: string;
  name: string;
  base_url: string;
  is_active: boolean;
  ai_api_keys?: Array<{
    id: string;
    label: string;
    masked_key: string | null;
    status: string;
    priority: number;
  }>;
};

export default function ProviderIntegrationsPanel({
  templates,
  initialProviders,
}: {
  templates: ProviderTemplate[];
  initialProviders: ProviderRow[];
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [providers, setProviders] = useState(initialProviders);

  const refreshProviders = async () => {
    try {
      const res = await fetch('/api/admin/providers');
      const data = await res.json();
      if (res.ok && Array.isArray(data.providers)) setProviders(data.providers);
    } catch {
      // Keep the current cards visible if a refresh fails.
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">Encrypted multi-provider integrations</div>
            <p className="text-xs text-zinc-500 mt-1 max-w-xl">
              Add multiple provider API keys and import as many models as you need. Free Guard decides which models are allowed into public runtime.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> Add integration
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {templates.map((template) => {
          const stored = providers.find((provider) => provider.slug === template.id);
          const activeKeys = (stored?.ai_api_keys ?? []).filter((key) => key.status === 'active');
          const configured = Boolean(stored && activeKeys.length > 0 && stored.is_active);

          return (
            <div key={template.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex flex-col min-h-44">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${configured ? 'bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]' : 'bg-zinc-300 dark:bg-zinc-700'}`} />
                    <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 truncate">{template.name}</h3>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{template.description}</p>
                </div>
                <Boxes className="w-4 h-4 text-zinc-400 shrink-0" />
              </div>

              <div className="mt-auto pt-4 flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-400">Credential</div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-300">
                    <KeyRound className="w-3.5 h-3.5" />
                    {activeKeys.length > 0 ? `${activeKeys.length} active key${activeKeys.length === 1 ? '' : 's'}` : 'Not connected'}
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full ${configured ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                  {configured ? 'Connected' : template.requiresBaseUrl ? 'Custom URL' : 'Available'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link href="/admin/routing" className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-3 hover:border-blue-300 dark:hover:border-blue-800 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/40 flex items-center justify-center text-blue-500"><Route className="w-4 h-4" /></div>
          <div><div className="text-sm font-semibold">Smart Default Pool</div><div className="text-xs text-zinc-500 mt-0.5">Choose preferred + automatic fallback models.</div></div>
        </Link>
        <Link href="/admin/health" className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-center gap-3 hover:border-emerald-300 dark:hover:border-emerald-800 transition-colors">
          <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center text-emerald-500"><Activity className="w-4 h-4" /></div>
          <div><div className="text-sm font-semibold">Live Health</div><div className="text-xs text-zinc-500 mt-0.5">See green, limited and unavailable models.</div></div>
        </Link>
      </div>

      {wizardOpen && (
        <AddProviderWizard
          onCancel={() => setWizardOpen(false)}
          onSuccess={() => {
            setWizardOpen(false);
            void refreshProviders();
          }}
        />
      )}
    </div>
  );
}
