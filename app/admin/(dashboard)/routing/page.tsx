'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Check, Loader2, Route, Save, ShieldCheck, Sparkles } from 'lucide-react';

type ModelOption = {
  recordId: string;
  modelId: string;
  name: string;
  alias: string | null;
  providerId: string;
  providerName: string;
  runtimeEligible: boolean;
  billingClassification: string;
};

type Config = {
  preferredModelRecordId: string | null;
  poolModelRecordIds: string[];
};

export default function RoutingPage() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [config, setConfig] = useState<Config>({ preferredModelRecordId: null, poolModelRecordIds: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/routing');
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load routing settings.');
      setModels(data.models || []);
      setConfig(data.config || { preferredModelRecordId: null, poolModelRecordIds: [] });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not load routing settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const eligibleModels = useMemo(() => models.filter((model) => model.runtimeEligible), [models]);

  const togglePool = (recordId: string) => {
    setConfig((current) => {
      const exists = current.poolModelRecordIds.includes(recordId);
      const poolModelRecordIds = exists
        ? current.poolModelRecordIds.filter((id) => id !== recordId)
        : [...current.poolModelRecordIds, recordId];
      const preferredModelRecordId =
        exists && current.preferredModelRecordId === recordId ? null : current.preferredModelRecordId;
      return { ...current, poolModelRecordIds, preferredModelRecordId };
    });
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/routing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not save Smart Auto routing.');
      setConfig(data.config);
      setMessage('Smart Auto routing saved. AbhiAI Auto will use this pool immediately.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save routing.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-7 h-7 animate-spin text-zinc-400" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <Route className="w-6 h-6 text-blue-500" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Smart Routing</h1>
          </div>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Build the default AbhiAI Auto pool. Cooling, rate-limited or unavailable models are skipped automatically.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save routing
        </button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Routing mode</div>
          <div className="mt-2 flex items-center gap-2 font-semibold"><Sparkles className="w-4 h-4 text-blue-500" /> Smart Auto</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pool models</div>
          <div className="mt-2 text-2xl font-bold">{config.poolModelRecordIds.length}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Safety</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400"><ShieldCheck className="w-4 h-4" /> Free Guard enforced</div>
        </div>
      </div>

      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Default model pool</h2>
          <p className="text-xs text-zinc-500 mt-1">Select as many eligible models as you want. Choose one preferred model; the remaining selected models act as automatic fallbacks.</p>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {eligibleModels.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">No Free Guard-approved active models are available yet. Add models in Providers first.</div>
          ) : eligibleModels.map((model) => {
            const inPool = config.poolModelRecordIds.includes(model.recordId);
            const preferred = config.preferredModelRecordId === model.recordId;
            return (
              <div key={model.recordId} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <button type="button" onClick={() => togglePool(model.recordId)} className="flex items-start gap-3 text-left min-w-0">
                  <span className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${inPool ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-300 dark:border-zinc-700'}`}>
                    {inPool && <Check className="w-3.5 h-3.5" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">{model.alias || model.name}</span>
                    <span className="block text-xs text-zinc-500 mt-0.5 break-all">{model.providerName} · {model.modelId}</span>
                  </span>
                </button>

                <div className="flex items-center gap-2 pl-8 sm:pl-0">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Eligible</span>
                  <button
                    type="button"
                    disabled={!inPool}
                    onClick={() => setConfig((current) => ({ ...current, preferredModelRecordId: preferred ? null : model.recordId }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${preferred ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                  >
                    {preferred ? 'Preferred' : 'Set preferred'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {message && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
          <Activity className="w-4 h-4 text-blue-500" /> {message}
        </div>
      )}
    </div>
  );
}
