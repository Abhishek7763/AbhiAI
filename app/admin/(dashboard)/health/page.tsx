'use client';

import React, { useState, useEffect } from 'react';
import { 
  Activity, CheckCircle, AlertTriangle, XCircle, RefreshCw, 
  Loader2, Clock, ShieldCheck, Cpu, ArrowRight, HelpCircle, Wrench
} from 'lucide-react';
import Link from 'next/link';

export default function HealthCenterPage() {
  const [healthData, setHealthData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  const fetchHealth = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/admin/health');
      const data = await res.json();
      if (Array.isArray(data.health)) {
        setHealthData(data.health);
      }
    } catch (e) {
      console.error('Failed to check health:', e);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    fetch('/api/admin/health')
      .then(res => res.json())
      .then(data => {
        if (isMounted && Array.isArray(data.health)) {
          setHealthData(data.health);
        }
      })
      .catch(err => console.error('Health check error:', err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const healthyCount = healthData.filter(h => h.status === 'HEALTHY').length;
  const degradedCount = healthData.filter(h => h.status === 'DEGRADED' || h.status === 'RATE_LIMITED').length;
  const errorCount = healthData.filter(h => h.status === 'OFFLINE' || h.status === 'AUTH_ERROR' || h.status === 'CONFIG_ERROR').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-emerald-500" /> Provider Health & Diagnostics
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Live latency monitoring and non-technical Error Doctor for all connected AI models.
          </p>
        </div>

        <button
          onClick={fetchHealth}
          disabled={checking}
          className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          Run Health Diagnostics
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Healthy Endpoints</span>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">{healthyCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 flex items-center justify-center text-emerald-500">
            <CheckCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Degraded / Rate Limited</span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">{degradedCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 flex items-center justify-center text-amber-500">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between shadow-sm">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Offline / Errors</span>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">{errorCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/50 flex items-center justify-center text-red-500">
            <XCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Health List */}
      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      ) : healthData.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-10 text-center space-y-3">
          <Cpu className="w-10 h-10 mx-auto text-zinc-400" />
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">No Providers Connected</h3>
          <p className="text-xs text-zinc-500 max-w-sm mx-auto">
            Add your first AI provider to start monitoring live model health and failover reliability.
          </p>
          <Link
            href="/admin/connections"
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl"
          >
            Add Provider in Connections <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {healthData.map((item) => {
            const isHealthy = item.status === 'HEALTHY';
            const isDegraded = item.status === 'DEGRADED' || item.status === 'RATE_LIMITED';
            return (
              <div 
                key={item.id}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-3.5"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full shrink-0 ${
                      isHealthy ? 'bg-emerald-500 animate-pulse' : isDegraded ? 'bg-amber-500' : 'bg-red-500'
                    }`} />
                    <div>
                      <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                        {item.name}
                      </h4>
                      <span className="text-xs text-zinc-400 font-mono">
                        Model: {item.modelId}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1 text-zinc-500 font-mono">
                      <Clock className="w-3.5 h-3.5" /> {item.latencyMs}ms
                    </span>
                    <span className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] ${
                      isHealthy 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                        : isDegraded
                        ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                        : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                    }`}>
                      {item.status}
                    </span>
                  </div>
                </div>

                {/* Error Doctor Card */}
                {item.diagnosis && (
                  <div className="p-4 rounded-xl bg-red-50/70 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 text-xs space-y-1.5">
                    <div className="flex items-center gap-2 font-bold text-red-800 dark:text-red-300">
                      <HelpCircle className="w-4 h-4 text-red-500 shrink-0" />
                      <span>{item.diagnosis.userTitle}</span>
                    </div>
                    <p className="text-red-700 dark:text-red-400">
                      {item.diagnosis.userMessage}
                    </p>
                    <div className="pt-2 flex items-center justify-between border-t border-red-200/60 dark:border-red-900/40">
                      <span className="text-red-900 dark:text-red-200 font-medium">
                        💡 Fix: {item.diagnosis.recommendedAction}
                      </span>
                      <Link
                        href="/admin/connections"
                        className="font-bold underline text-red-800 dark:text-red-300 hover:opacity-80"
                      >
                        Fix in Connections
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
