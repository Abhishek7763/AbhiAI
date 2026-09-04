'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle,
  Clock,
  Cpu,
  HelpCircle,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'RATE_LIMITED' | 'AUTH_ERROR' | 'OFFLINE' | 'CONFIG_ERROR';

type HealthItem = {
  id: string;
  name: string;
  modelId: string;
  provider: string;
  status: HealthStatus;
  latencyMs: number;
  lastChecked: string;
  failureReason: string | null;
  diagnosis?: {
    userTitle: string;
    userMessage: string;
    recommendedAction: string;
  };
  runtime?: {
    cooldownUntil: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastErrorCode: string | number | null;
    lastFailureReason: string | null;
    consecutiveFailures: number;
    lastLatencyMs: number | null;
    avgLatencyMs: number | null;
  } | null;
};

type HealthResponse = {
  health?: HealthItem[];
  error?: string;
};

function formatTime(value: string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString();
}

function statusLabel(status: HealthStatus) {
  return status.replaceAll('_', ' ');
}

export default function HealthCenterPage() {
  const [healthData, setHealthData] = useState<HealthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);

  const fetchHealth = useCallback(async (manual = false) => {
    if (manual) setChecking(true);
    setPageError(null);
    try {
      const res = await fetch('/api/admin/health', { cache: 'no-store' });
      const data = await res.json() as HealthResponse;
      if (!res.ok) throw new Error(data.error || 'Health diagnostics failed.');
      setHealthData(Array.isArray(data.health) ? data.health : []);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Health diagnostics failed.');
    } finally {
      setLoading(false);
      if (manual) setChecking(false);
    }
  }, []);

  useEffect(() => {
    void fetchHealth(false);
  }, [fetchHealth]);

  const counts = useMemo(() => ({
    healthy: healthData.filter((item) => item.status === 'HEALTHY').length,
    limited: healthData.filter((item) => item.status === 'DEGRADED' || item.status === 'RATE_LIMITED').length,
    errors: healthData.filter((item) => ['OFFLINE', 'AUTH_ERROR', 'CONFIG_ERROR'].includes(item.status)).length,
  }), [healthData]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            <Activity className="h-6 w-6 text-emerald-500" /> Health Center
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Live provider state, runtime history, latency and clear failure reasons in one place.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchHealth(true)}
          disabled={checking}
          className="flex items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} />
          Run Health Diagnostics
        </button>
      </div>

      {pageError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {pageError}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Healthy" value={counts.healthy} tone="healthy" />
        <MetricCard label="Degraded / Rate Limited" value={counts.limited} tone="warning" />
        <MetricCard label="Offline / Errors" value={counts.errors} tone="error" />
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        </div>
      ) : healthData.length === 0 ? (
        <div className="space-y-3 rounded-3xl border border-zinc-200 bg-white p-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <Cpu className="mx-auto h-10 w-10 text-zinc-400" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">No monitored models</h3>
          <p className="mx-auto max-w-sm text-xs text-zinc-500">
            Add and activate a Free Guard approved provider/model to start live health monitoring.
          </p>
          <Link href="/admin/connections" className="inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            Open Connections <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {healthData.map((item) => <HealthCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone: 'healthy' | 'warning' | 'error' }) {
  const styles = tone === 'healthy'
    ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50'
    : tone === 'warning'
      ? 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50'
      : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/50';
  const Icon = tone === 'healthy' ? CheckCircle : tone === 'warning' ? AlertTriangle : XCircle;
  return (
    <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">{label}</span>
        <div className={`mt-1 text-2xl font-bold ${styles.split(' ').slice(0, 2).join(' ')}`}>{value}</div>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${styles}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  );
}

function HealthCard({ item }: { item: HealthItem }) {
  const healthy = item.status === 'HEALTHY';
  const warning = item.status === 'DEGRADED' || item.status === 'RATE_LIMITED';
  const badge = healthy
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400'
    : warning
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400'
      : 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-400';
  const dot = healthy ? 'bg-emerald-500' : warning ? 'bg-amber-500' : 'bg-red-500';
  const runtimeFailure = item.runtime?.lastFailureReason || (item.runtime?.lastErrorCode ? `Error ${item.runtime.lastErrorCode}` : null);

  return (
    <div className="space-y-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-3 w-3 shrink-0 rounded-full ${dot} ${healthy ? 'animate-pulse' : ''}`} />
          <div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{item.name}</h4>
            <p className="text-xs text-zinc-400"><span className="font-medium">{item.provider}</span> · <span className="font-mono">{item.modelId}</span></p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-zinc-500"><Clock className="h-3.5 w-3.5" /> {item.latencyMs}ms</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${badge}`}>{statusLabel(item.status)}</span>
        </div>
      </div>

      <div className="grid gap-3 rounded-xl bg-zinc-50 p-3 text-xs dark:bg-zinc-950/60 sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Last checked" value={formatTime(item.lastChecked)} />
        <Info label="Failure reason" value={item.failureReason || 'None'} />
        <Info label="Last runtime failure" value={runtimeFailure || 'None'} />
        <Info label="Consecutive failures" value={String(item.runtime?.consecutiveFailures ?? 0)} />
      </div>

      {item.runtime?.cooldownUntil && new Date(item.runtime.cooldownUntil).getTime() > Date.now() && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          Temporarily cooling down until {formatTime(item.runtime.cooldownUntil)}. Smart Routing will prefer another healthy model.
        </div>
      )}

      {item.diagnosis && (
        <div className={`space-y-2 rounded-xl border p-4 text-xs ${warning ? 'border-amber-200 bg-amber-50/70 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300' : 'border-red-200 bg-red-50/70 text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300'}`}>
          <div className="flex items-center gap-2 font-bold"><HelpCircle className="h-4 w-4 shrink-0" /> {item.diagnosis.userTitle}</div>
          <p>{item.diagnosis.userMessage}</p>
          <div className="flex flex-col gap-2 border-t border-current/15 pt-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium">Fix: {item.diagnosis.recommendedAction}</span>
            <Link href="/admin/connections" className="font-bold underline hover:opacity-80">Fix in Connections</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">{label}</div>
      <div className="mt-1 break-words font-medium text-zinc-700 dark:text-zinc-300">{value}</div>
    </div>
  );
}
