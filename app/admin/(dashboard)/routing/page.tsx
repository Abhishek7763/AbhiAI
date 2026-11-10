'use client';

import { useEffect, useMemo, useState } from 'react';
import { Activity, Check, Gauge, Loader2, LockKeyhole, Route, Save, ShieldCheck, Sparkles } from 'lucide-react';

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

type HealthRow = {
  id: string;
  status: 'HEALTHY' | 'DEGRADED' | 'RATE_LIMITED' | 'AUTH_ERROR' | 'OFFLINE' | 'CONFIG_ERROR';
  latencyMs: number;
};

type Config = {
  preferredModelRecordId: string | null;
  poolModelRecordIds: string[];
  strictPool: boolean;
};

const EMPTY_CONFIG: Config = {
  preferredModelRecordId: null,
  poolModelRecordIds: [],
  strictPool: false,
};

function healthMeta(status: HealthRow['status'] | 'UNKNOWN') {
  if (status === 'HEALTHY') {
    return { label: 'Healthy', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' };
  }
  if (status === 'DEGRADED' || status === 'RATE_LIMITED') {
    return { label: status === 'RATE_LIMITED' ? 'Rate limited' : 'Limited', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' };
  }
  if (status === 'AUTH_ERROR' || status === 'OFFLINE' || status === 'CONFIG_ERROR') {
    return { label: 'Unavailable', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' };
  }
  return { label: 'Not checked', dot: 'bg-zinc-300 dark:bg-zinc-700', text: 'text-zinc-500' };
}

export default function RoutingPage() {
  const [models, setModels] = useState<ModelOption[]>([]);
  const [healthData, setHealthData] = useState<HealthRow[]>([]);
  const [config, setConfig] = useState<Config>(EMPTY_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    Promise.all([
      fetch('/api/admin/routing').then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Could not load routing settings.');
        return data;
      }),
      fetch('/api/admin/health', { cache: 'no-store' })
        .then((res) => res.json())
        .catch(() => ({ health: [] })),
    ])
      .then(([routingData, healthResponse]) => {
        if (!mounted) return;
        setModels(routingData.models || []);
        setConfig({ ...EMPTY_CONFIG, ...(routingData.config || {}) });
        setHealthData(Array.isArray(healthResponse.health) ? healthResponse.health : []);
      })
      .catch((error) => {
        if (mounted) setMessage(error instanceof Error ? error.message : 'Could not load routing settings.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const eligibleModels = useMemo(() => models.filter((model) => model.runtimeEligible), [models]);
  const healthById = useMemo(() => new Map(healthData.map((row) => [row.id, row])), [healthData]);
  const healthyPoolCount = useMemo(
    () => config.poolModelRecordIds.filter((id) => healthById.get(id)?.status === 'HEALTHY').length,
    [config.poolModelRecordIds, healthById],
  );

  const togglePool = (recordId: string) => {
    setConfig((current) => {
      const exists = current.poolModelRecordIds.includes(recordId);
      const poolModelRecordIds = exists
        ? current.poolModelRecordIds.filter((id) => id !== recordId)
        : [...current.poolModelRecordIds, recordId];
      const preferredModelRecordId =
        exists && current.preferredModelRecordId === recordId ? null : current.preferredModelRecordId;
      return {
        ...current,
        poolModelRecordIds,
        preferredModelRecordId,
        strictPool: poolModelRecordIds.length === 0 ? false : current.strictPool,
      };
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
      setConfig({ ...EMPTY_CONFIG, ...data.config });
      setMessage(
        data.config?.strictPool
          ? 'Smart Auto saved. Only your selected pool can be used, ranked intelligently per request.'
          : 'Smart Auto saved. Your pool is preferred, with emergency runtime fallbacks allowed.',
      );
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
            AbhiAI Auto ranks your pool for every request instead of blindly using one fixed model.
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

      <div className="grid sm:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Routing mode</div>
          <div className="mt-2 flex items-center gap-2 font-semibold"><Sparkles className="w-4 h-4 text-blue-500" /> Smart Score</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pool models</div>
          <div className="mt-2 text-2xl font-bold">{config.poolModelRecordIds.length}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Healthy now</div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">{healthyPoolCount}</div>
        </div>
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Safety</div>
          <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400"><ShieldCheck className="w-4 h-4" /> Free Guard</div>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-200/70 dark:border-blue-900/70 bg-blue-50/70 dark:bg-blue-950/20 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-white dark:bg-zinc-900 border border-blue-100 dark:border-blue-900 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Gauge className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Smart score is active</div>
            <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1 max-w-2xl">
              Health, recent success, learned latency, query capability and admin priority are combined. Preferred gives a strong boost, but a clearly healthier or better-suited model can still win.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={config.poolModelRecordIds.length === 0}
          onClick={() => setConfig((current) => ({ ...current, strictPool: !current.strictPool }))}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2.5 text-sm font-semibold disabled:opacity-40"
        >
          <span className={`w-9 h-5 rounded-full p-0.5 transition-colors ${config.strictPool ? 'bg-blue-600' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
            <span className={`block w-4 h-4 rounded-full bg-white transition-transform ${config.strictPool ? 'translate-x-4' : 'translate-x-0'}`} />
          </span>
          <LockKeyhole className="w-4 h-4" />
          Strict Pool {config.strictPool ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-5 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Default model pool</h2>
          <p className="text-xs text-zinc-500 mt-1">
            All selected models stay in your Auto pool. The router scores them for each request. Preferred is a boost, not a hard lock. Only the best healthy candidates are tried per request to avoid long timeout chains.
          </p>
        </div>

        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {eligibleModels.length === 0 ? (
            <div className="p-8 text-center text-sm text-zinc-500">No Free Guard-approved active models are available yet. Add models in Providers first.</div>
          ) : eligibleModels.map((model) => {
            const inPool = config.poolModelRecordIds.includes(model.recordId);
            const preferred = config.preferredModelRecordId === model.recordId;
            const health = healthById.get(model.recordId);
            const live = healthMeta(health?.status || 'UNKNOWN');
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

                <div className="flex items-center gap-2 pl-8 sm:pl-0 flex-wrap justify-end">
                  <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${live.text}`}>
                    <span className={`w-2 h-2 rounded-full ${live.dot}`} /> {live.label}
                    {health && health.latencyMs > 0 ? ` · ${health.latencyMs}ms` : ''}
                  </span>
                  <button
                    type="button"
                    disabled={!inPool}
                    onClick={() => setConfig((current) => ({ ...current, preferredModelRecordId: preferred ? null : model.recordId }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors disabled:opacity-40 ${preferred ? 'bg-blue-600 border-blue-600 text-white' : 'border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300'}`}
                  >
                    {preferred ? 'Preferred boost' : 'Set preferred'}
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
