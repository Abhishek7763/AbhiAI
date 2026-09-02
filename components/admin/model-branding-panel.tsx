'use client';

import { useState } from 'react';
import { Check, Loader2, PencilLine, Sparkles } from 'lucide-react';
import { getDefaultAbhiAIModelName } from '@/lib/ai/model-branding';

type ModelItem = {
  id: string;
  providerId: string;
  name: string;
  alias: string;
  capabilities: string[];
  isActive: boolean;
  isPublic: boolean;
  isFree: boolean;
};

export function ModelBrandingPanel({ initialModels }: { initialModels: ModelItem[] }) {
  const [models, setModels] = useState(initialModels);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialModels.map((model) => [
        model.id,
        model.alias && !model.alias.toLowerCase().includes('gemini') && !model.alias.toLowerCase().includes('google')
          ? model.alias
          : getDefaultAbhiAIModelName(model.id),
      ]),
    ),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const saveAlias = async (modelId: string) => {
    const alias = drafts[modelId]?.trim();
    if (!alias) return;

    setSavingId(modelId);
    setSavedId(null);
    setError('');
    try {
      const response = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: modelId, updates: { alias } }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save model name.');

      setModels((current) => current.map((model) => (model.id === modelId ? { ...model, alias } : model)));
      setSavedId(modelId);
      window.setTimeout(() => setSavedId((current) => (current === modelId ? null : current)), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save model name.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">AbhiAI model names</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              These names are shown in the public chat. Google/Gemini model IDs stay internal so you can change providers later without changing the AbhiAI brand.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-3">
        {models.map((model) => (
          <div key={model.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <PencilLine className="h-4 w-4 text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                    {model.alias && !model.alias.toLowerCase().includes('gemini') && !model.alias.toLowerCase().includes('google')
                      ? model.alias
                      : getDefaultAbhiAIModelName(model.id)}
                  </span>
                </div>
                <div className="mt-1 truncate font-mono text-[11px] text-zinc-400">{model.id}</div>
              </div>

              <div className="flex w-full gap-2 lg:max-w-md">
                <input
                  value={drafts[model.id] ?? ''}
                  onChange={(event) => setDrafts((current) => ({ ...current, [model.id]: event.target.value }))}
                  maxLength={32}
                  className="min-w-0 flex-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  placeholder={getDefaultAbhiAIModelName(model.id)}
                />
                <button
                  type="button"
                  onClick={() => saveAlias(model.id)}
                  disabled={savingId === model.id || !drafts[model.id]?.trim()}
                  className="inline-flex min-w-20 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                >
                  {savingId === model.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedId === model.id ? <Check className="h-3.5 w-3.5" /> : null}
                  {savingId === model.id ? 'Saving' : savedId === model.id ? 'Saved' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
