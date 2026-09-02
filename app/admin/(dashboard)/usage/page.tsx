'use client';

import { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { Activity, Zap, Users, ShieldAlert, Clock, RefreshCw, Loader2, Server } from 'lucide-react';

const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4'];

export default function UsagePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsage = () => {
    setRefreshing(true);
    fetch('/api/admin/usage')
      .then(res => res.json())
      .then(json => {
        setData(json);
      })
      .catch(console.error)
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    let isMounted = true;
    fetch('/api/admin/usage')
      .then(res => res.json())
      .then(json => {
        if (isMounted) setData(json);
      })
      .catch(console.error)
      .finally(() => {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      });

    return () => { isMounted = false; };
  }, []);

  if (loading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  const stats = data?.stats || {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    failoverEvents: 0,
    totalTokensEstimated: 0,
    avgLatency: 0,
  };

  const modelBreakdown = data?.modelBreakdown || [];
  const recentLogs = data?.recentLogs || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-emerald-500" /> Usage & Telemetry Analytics
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1 text-sm">
            Live request volume, estimated token consumption, failover triggers, and model distribution.
          </p>
        </div>

        <button
          onClick={fetchUsage}
          disabled={refreshing}
          className="bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-4 py-2 rounded-xl text-xs font-semibold hover:opacity-90 transition-all flex items-center gap-2 shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh Stats
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            <h3 className="font-medium text-xs uppercase tracking-wider">Total Requests</h3>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.totalRequests}</p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2 font-medium">
            {stats.successfulRequests} successful ({stats.totalRequests > 0 ? Math.round((stats.successfulRequests / stats.totalRequests) * 100) : 100}%)
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <h3 className="font-medium text-xs uppercase tracking-wider">Est. Tokens</h3>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            {stats.totalTokensEstimated.toLocaleString()}
          </p>
          <p className="text-xs text-zinc-400 mt-2 font-medium">
            100% Free Tiers Utilized
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="font-medium text-xs uppercase tracking-wider">Avg Latency</h3>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.avgLatency}ms</p>
          <p className="text-xs text-blue-500 mt-2 font-medium">
            Real-time streaming TTFT
          </p>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-3 text-zinc-500 dark:text-zinc-400 mb-2">
            <ShieldAlert className="w-5 h-5 text-purple-500" />
            <h3 className="font-medium text-xs uppercase tracking-wider">Failovers Handled</h3>
          </div>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{stats.failoverEvents}</p>
          <p className="text-xs text-purple-500 mt-2 font-medium">
            Zero-downtime reroutes
          </p>
        </div>
      </div>

      {/* Model Distribution & Real-time Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-500" /> Model Share Breakdown
            </h3>
            {modelBreakdown.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-zinc-400">
                No request traffic recorded yet.
              </div>
            ) : (
              <div className="space-y-3">
                {modelBreakdown.map((item: any, idx: number) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-zinc-600 dark:text-zinc-400 truncate max-w-[160px]">
                      {item.name}
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-zinc-100">
                      {item.count} reqs
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm flex flex-col">
          <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 mb-4">
            Recent Telemetry Stream (Last 50 Events)
          </h3>
          
          {recentLogs.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-zinc-400">
              No recent requests logged.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400">
                    <th className="pb-2 font-semibold">Time</th>
                    <th className="pb-2 font-semibold">Model / Alias</th>
                    <th className="pb-2 font-semibold">Latency</th>
                    <th className="pb-2 font-semibold">Chars</th>
                    <th className="pb-2 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                  {recentLogs.map((log: any) => (
                    <tr key={log.id} className="text-zinc-600 dark:text-zinc-400">
                      <td className="py-2.5 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 font-mono text-[11px] text-zinc-900 dark:text-zinc-200">
                        {log.modelOrAlias}
                        {log.failoverUsed && (
                          <span className="ml-1 text-[9px] bg-purple-100 dark:bg-purple-950 text-purple-600 px-1.5 py-0.5 rounded font-bold">
                            FAILOVER
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 font-mono text-[11px]">
                        {log.durationMs}ms
                      </td>
                      <td className="py-2.5 font-mono text-[11px]">
                        {log.promptLength} / {log.responseLength}
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'success'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400'
                            : 'bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-400'
                        }`}>
                          {log.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
