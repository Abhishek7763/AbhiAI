'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Bell, Clock, DollarSign, Loader2, RefreshCw, Server, ShieldAlert, Zap } from 'lucide-react';

type UsageData = {
  stats: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    failoverEvents: number;
    totalTokensEstimated: number;
    avgLatency: number;
    totalEstimatedCostUsd: number;
  };
  modelPerformance: Array<{
    name: string;
    provider: string;
    requests: number;
    successRate: number;
    avgLatency: number;
    estimatedCostUsd: number;
  }>;
  providerDaily: Array<{
    date: string;
    provider: string;
    requests: number;
    successes: number;
    failures: number;
    estimatedCostUsd: number;
  }>;
  recentAlerts: Array<{
    id: string;
    kind: string;
    severity: 'warning' | 'critical';
    message: string;
    notified_at: string | null;
    created_at: string;
  }>;
  recentLogs: Array<{
    id: string;
    timestamp: string;
    modelOrAlias: string;
    durationMs: number;
    promptLength: number;
    responseLength: number;
    failoverUsed: boolean;
    status: 'success' | 'error';
  }>;
};

const emptyStats: UsageData['stats'] = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  failoverEvents: 0,
  totalTokensEstimated: 0,
  avgLatency: 0,
  totalEstimatedCostUsd: 0,
};

export default function UsagePage() {
  const [data, setData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadUsage = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    setError('');
    try {
      const response = await fetch('/api/admin/usage', { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok) throw new Error(json?.error || 'Failed to load usage analytics.');
      setData(json);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load usage analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    fetch('/api/admin/usage', { cache: 'no-store' })
      .then(async (response) => {
        const json = await response.json();
        if (!response.ok) throw new Error(json?.error || 'Failed to load usage analytics.');
        if (active) setData(json);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Failed to load usage analytics.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>;
  }

  const stats = data?.stats ?? emptyStats;
  const successRate = stats.totalRequests ? Math.round((stats.successfulRequests / stats.totalRequests) * 100) : 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-emerald-500" /> Admin & Ops
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Provider usage, estimated cost, reliability, failovers, alerts, and model A/B performance.
          </p>
        </div>
        <button
          onClick={() => void loadUsage(true)}
          disabled={refreshing}
          className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Refresh Stats
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        <MetricCard icon={<Activity className="w-5 h-5 text-emerald-500" />} label="Total Requests" value={String(stats.totalRequests)} note={`${successRate}% successful`} />
        <MetricCard icon={<Zap className="w-5 h-5 text-amber-500" />} label="Est. Tokens" value={stats.totalTokensEstimated.toLocaleString()} note="Prompt + response estimate" />
        <MetricCard icon={<Clock className="w-5 h-5 text-blue-500" />} label="Avg Latency" value={`${stats.avgLatency}ms`} note="Across stored telemetry" />
        <MetricCard icon={<ShieldAlert className="w-5 h-5 text-purple-500" />} label="Failovers" value={String(stats.failoverEvents)} note="Automatic reroutes" />
        <MetricCard icon={<DollarSign className="w-5 h-5 text-emerald-500" />} label="Est. Cost" value={`$${stats.totalEstimatedCostUsd.toFixed(4)}`} note="Zero for free/unpriced models" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Panel title="Provider Usage by Day" icon={<Server className="w-4 h-4 text-blue-500" />}>
          {data?.providerDaily?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <tr><th className="pb-2">Date</th><th className="pb-2">Provider</th><th className="pb-2">Requests</th><th className="pb-2">Failed</th><th className="pb-2 text-right">Cost</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {data.providerDaily.map((row) => (
                    <tr key={`${row.date}-${row.provider}`}>
                      <td className="py-2.5 font-mono text-zinc-500">{row.date}</td>
                      <td className="py-2.5 font-medium text-zinc-800 dark:text-zinc-200">{row.provider}</td>
                      <td className="py-2.5">{row.requests}</td>
                      <td className={`py-2.5 ${row.failures ? 'text-red-500 font-semibold' : ''}`}>{row.failures}</td>
                      <td className="py-2.5 text-right font-mono">${row.estimatedCostUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyText>No provider traffic recorded yet.</EmptyText>}
        </Panel>

        <Panel title="Model A/B Performance" icon={<Activity className="w-4 h-4 text-emerald-500" />}>
          {data?.modelPerformance?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <tr><th className="pb-2">Model</th><th className="pb-2">Reqs</th><th className="pb-2">Success</th><th className="pb-2">Latency</th><th className="pb-2 text-right">Cost</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {data.modelPerformance.map((row) => (
                    <tr key={`${row.provider}-${row.name}`}>
                      <td className="py-2.5"><div className="font-medium text-zinc-800 dark:text-zinc-200 max-w-56 truncate">{row.name}</div><div className="text-[10px] text-zinc-400">{row.provider}</div></td>
                      <td className="py-2.5">{row.requests}</td>
                      <td className="py-2.5"><span className={row.successRate >= 95 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : row.successRate < 80 ? 'text-red-500 font-semibold' : ''}>{row.successRate}%</span></td>
                      <td className="py-2.5 font-mono">{row.avgLatency}ms</td>
                      <td className="py-2.5 text-right font-mono">${row.estimatedCostUsd.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyText>No model comparison data yet.</EmptyText>}
        </Panel>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Panel title="Ops Alerts" icon={<Bell className="w-4 h-4 text-amber-500" />} className="xl:col-span-1">
          {data?.recentAlerts?.length ? (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {data.recentAlerts.map((alert) => (
                <div key={alert.id} className={`rounded-xl border p-3 ${alert.severity === 'critical' ? 'border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/20' : 'border-amber-200 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/20'}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wide font-bold">{alert.severity}</span>
                    <span className="text-[10px] text-zinc-400">{new Date(alert.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">{alert.message}</p>
                  <p className="text-[10px] text-zinc-400 mt-1">{alert.notified_at ? 'Webhook notified' : 'Recorded locally'}</p>
                </div>
              ))}
            </div>
          ) : <EmptyText>No alerts. Providers look healthy.</EmptyText>}
        </Panel>

        <Panel title="Recent Telemetry" icon={<Server className="w-4 h-4 text-zinc-500" />} className="xl:col-span-2">
          {data?.recentLogs?.length ? (
            <div className="overflow-x-auto max-h-80 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 sticky top-0 bg-white dark:bg-zinc-900">
                  <tr><th className="pb-2">Time</th><th className="pb-2">Model / Alias</th><th className="pb-2">Latency</th><th className="pb-2">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {data.recentLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="py-2.5 font-mono text-[11px] text-zinc-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                      <td className="py-2.5 font-mono text-[11px] text-zinc-800 dark:text-zinc-200">{log.modelOrAlias}{log.failoverUsed && <span className="ml-1 text-[9px] bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-300 px-1.5 py-0.5 rounded font-bold">FAILOVER</span>}</td>
                      <td className="py-2.5 font-mono text-[11px]">{log.durationMs}ms</td>
                      <td className="py-2.5"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${log.status === 'success' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'}`}>{log.status.toUpperCase()}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyText>No recent requests logged.</EmptyText>}
        </Panel>
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400">
        Webhook alerts use <code className="font-mono text-zinc-700 dark:text-zinc-300">OPS_ALERT_WEBHOOK_URL</code>. Repeated provider failures are detected automatically. API-key quota alerts activate only when a daily quota is configured for that key.
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
      <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-2">{icon}<h3 className="font-medium text-xs uppercase tracking-wider">{label}</h3></div>
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{value}</p>
      <p className="text-xs text-zinc-400 mt-2 font-medium">{note}</p>
    </div>
  );
}

function Panel({ title, icon, className = '', children }: { title: string; icon: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm ${className}`}>
      <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">{icon}{title}</h2>
      {children}
    </section>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <div className="h-36 flex items-center justify-center text-xs text-zinc-400">{children}</div>;
}
