'use client';

import { useState } from 'react';
import { Check, Loader2, PencilLine, Power, ShieldCheck } from 'lucide-react';

type ModelItem = {
  recordId?: string;
  id: string;
  providerId: string;
  name: string;
  alias: string;
  capabilities: string[];
  isActive: boolean;
  isPublic: boolean;
  isFree: boolean;
};

function modelKey(model: ModelItem) {
  return model.recordId || `${model.providerId}:${model.id}`;
}

export function ModelBrandingPanel({ initialModels }: { initialModels: ModelItem[] }) {
  const [models, setModels] = useState(initialModels);
  const [drafts, setDrafts] = useState<Record<string, string>>(() =>
    Object.fromEntries(initialModels.map((model) => [modelKey(model), model.alias || model.name])),
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const updateLocalModel = (key: string, updates: Partial<ModelItem>) => {
    setModels((current) => current.map((model) => (modelKey(model) === key ? { ...model, ...updates } : model)));
  };

  const saveModel = async (model: ModelItem) => {
    const key = modelKey(model);
    if (!model.recordId) {
      setError('This model is missing its unique database record ID. Refresh the page and try again.');
      return;
    }

    const alias = drafts[key]?.trim() || model.name;
    setSavingId(key);
    setSavedId(null);
    setError('');

    try {
      const response = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: model.recordId,
          updates: {
            alias,
            isActive: model.isActive,
            isPublic: model.isPublic,
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Could not save model settings.');

      updateLocalModel(key, { alias });
      setSavedId(key);
      window.setTimeout(() => setSavedId((current) => (current === key ? null : current)), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save model settings.');
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
            <PencilLine className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Imported model management</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Integrations add models. This page controls their display name, active state and public visibility. Each provider-specific model is managed independently, even when two providers use the same model ID.
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      {models.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900">
          No imported models yet. Add a provider from Integrations first.
        </div>
      ) : (
        <div className="grid gap-3">
          {models.map((model) => {
            const key = modelKey(model);
            return (
              <div key={key} className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="min-w-0 xl:max-w-md">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{model.alias || model.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${model.isFree ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'}`}>
                        {model.isFree ? 'Free Guard' : 'Unverified'}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">{model.providerId || 'provider'} · {model.name}</div>
                    <div className="mt-1 break-all font-mono text-[11px] text-zinc-400">{model.id}</div>
                  </div>

                  <div className="flex flex-1 flex-col gap-3 xl:max-w-2xl">
                    <input
                      value={drafts[key] ?? ''}
                      onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                      maxLength={48}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/15 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      placeholder="Public / admin display name"
                    />

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateLocalModel(key, { isActive: !model.isActive })}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${model.isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400'}`}
                      >
                        <Power className="h-3.5 w-3.5" /> {model.isActive ? 'Active' : 'Disabled'}
                      </button>

                      <button
                        type="button"
                        onClick={() => updateLocalModel(key, { isPublic: !model.isPublic })}
                        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${model.isPublic ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-300' : 'border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400'}`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" /> {model.isPublic ? 'Public' : 'Internal'}
                      </button>

                      <button
                        type="button"
                        onClick={() => void saveModel(model)}
                        disabled={savingId === key || !model.recordId}
                        className="ml-auto inline-flex min-w-24 items-center justify-center gap-1.5 rounded-xl bg-zinc-900 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
                      >
                        {savingId === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : savedId === key ? <Check className="h-3.5 w-3.5" /> : null}
                        {savingId === key ? 'Saving' : savedId === key ? 'Saved' : 'Save model'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
