'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Save, Sparkles } from 'lucide-react';

type Alias = { id: string; displayName: string; modelRecordId: string | null; enabled: boolean };
type Model = { recordId: string; name: string; modelId: string; providerName: string };

export default function PublicAIPage() {
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/public-aliases')
      .then(async (response) => {
        if (!response.ok) throw new Error('Failed to load aliases');
        return response.json();
      })
      .then((data) => {
        setAliases(data.aliases || []);
        setModels(data.models || []);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Failed to load aliases'))
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const response = await fetch('/api/admin/public-aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aliases }),
      });
      if (!response.ok) throw new Error('Failed to save aliases');
      const data = await response.json();
      setAliases(data.aliases || aliases);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save aliases');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            <Sparkles className="h-6 w-6 text-blue-500" /> Public AI Aliases
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Map simple AbhiAI names to private backend models. Visitors never need provider model IDs.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save aliases
        </button>
      </div>

      {saved && (
        <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4" /> Public aliases saved.
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {aliases.map((alias, index) => {
          const shortName = alias.displayName.replace(/\s*\([^)]*\)\s*$/, '');
          const description = alias.displayName.match(/\(([^)]*)\)/)?.[1] || 'Public AbhiAI option';
          return (
            <section key={alias.id} className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                <label className="flex min-w-0 flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={alias.enabled}
                    onChange={(event) => setAliases((current) => current.map((item, i) => i === index ? { ...item, enabled: event.target.checked } : item))}
                    className="h-5 w-5 accent-blue-600"
                  />
                  <span>
                    <span className="block font-semibold text-zinc-900 dark:text-zinc-100">{shortName}</span>
                    <span className="text-xs text-zinc-500">{description}</span>
                  </span>
                </label>

                <select
                  value={alias.modelRecordId || ''}
                  onChange={(event) => setAliases((current) => current.map((item, i) => i === index ? { ...item, modelRecordId: event.target.value || null } : item))}
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 md:max-w-md"
                >
                  <option value="">Not mapped</option>
                  {models.map((model) => (
                    <option key={model.recordId} value={model.recordId}>{model.name} — {model.providerName}</option>
                  ))}
                </select>
              </div>
            </section>
          );
        })}
      </div>

      <p className="text-xs leading-5 text-zinc-500">
        Only runtime-eligible free-tier models can be mapped. Backend model IDs stay inside the admin/server layer.
      </p>
    </div>
  );
}
