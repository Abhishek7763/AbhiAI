import { NextResponse } from 'next/server';
import { getStoredUsageLogs } from '@/lib/data/admin-config';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const logs = await getStoredUsageLogs();
    const supabase = createAdminClient();

    const [{ data: pricingRows, error: pricingError }, { data: alertRows, error: alertsError }] = await Promise.all([
      supabase.from('ai_models').select('model_id, input_cost_per_million, output_cost_per_million'),
      supabase.from('ops_alerts').select('id, kind, severity, message, notified_at, created_at').order('created_at', { ascending: false }).limit(20),
    ]);

    if (pricingError) throw new Error(pricingError.message);
    if (alertsError) throw new Error(alertsError.message);

    const pricing = new Map((pricingRows ?? []).map((row: any) => [row.model_id, {
      input: Number(row.input_cost_per_million ?? 0),
      output: Number(row.output_cost_per_million ?? 0),
    }]));

    const totalRequests = logs.length;
    const successfulRequests = logs.filter((log) => log.status === 'success').length;
    const failedRequests = logs.filter((log) => log.status === 'error').length;
    const failoverEvents = logs.filter((log) => log.failoverUsed).length;
    const totalTokensEstimated = logs.reduce((acc, log) => acc + Math.ceil((log.promptLength + log.responseLength) / 4), 0);
    const avgLatency = logs.length > 0 ? Math.round(logs.reduce((acc, log) => acc + log.durationMs, 0) / logs.length) : 0;

    const estimatedCostFor = (log: (typeof logs)[number]) => {
      const price = pricing.get(log.executedModelId ?? '');
      if (!price) return 0;
      const inputTokens = Math.ceil(log.promptLength / 4);
      const outputTokens = Math.ceil(log.responseLength / 4);
      return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
    };

    const totalEstimatedCostUsd = logs.reduce((sum, log) => sum + estimatedCostFor(log), 0);

    const modelMap = new Map<string, { name: string; provider: string; requests: number; successes: number; latency: number; cost: number }>();
    const providerDayMap = new Map<string, { date: string; provider: string; requests: number; successes: number; failures: number; cost: number }>();

    for (const log of logs) {
      const modelName = log.executedModelName || log.modelOrAlias;
      const modelKey = `${log.provider}:${modelName}`;
      const currentModel = modelMap.get(modelKey) ?? { name: modelName, provider: log.provider, requests: 0, successes: 0, latency: 0, cost: 0 };
      currentModel.requests += 1;
      currentModel.successes += log.status === 'success' ? 1 : 0;
      currentModel.latency += log.durationMs;
      currentModel.cost += estimatedCostFor(log);
      modelMap.set(modelKey, currentModel);

      const date = new Date(log.timestamp).toISOString().slice(0, 10);
      const providerKey = `${date}:${log.provider}`;
      const currentProvider = providerDayMap.get(providerKey) ?? { date, provider: log.provider, requests: 0, successes: 0, failures: 0, cost: 0 };
      currentProvider.requests += 1;
      currentProvider.successes += log.status === 'success' ? 1 : 0;
      currentProvider.failures += log.status === 'error' ? 1 : 0;
      currentProvider.cost += estimatedCostFor(log);
      providerDayMap.set(providerKey, currentProvider);
    }

    const modelPerformance = Array.from(modelMap.values())
      .map((item) => ({
        name: item.name,
        provider: item.provider,
        requests: item.requests,
        successRate: item.requests ? Math.round((item.successes / item.requests) * 100) : 0,
        avgLatency: item.requests ? Math.round(item.latency / item.requests) : 0,
        estimatedCostUsd: Number(item.cost.toFixed(6)),
      }))
      .sort((a, b) => b.requests - a.requests);

    const providerDaily = Array.from(providerDayMap.values())
      .map((item) => ({ ...item, estimatedCostUsd: Number(item.cost.toFixed(6)) }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.requests - a.requests)
      .slice(0, 50);

    return NextResponse.json({
      stats: {
        totalRequests,
        successfulRequests,
        failedRequests,
        failoverEvents,
        totalTokensEstimated,
        avgLatency,
        totalEstimatedCostUsd: Number(totalEstimatedCostUsd.toFixed(6)),
      },
      modelBreakdown: modelPerformance.map((item) => ({ name: item.name, count: item.requests })),
      modelPerformance,
      providerDaily,
      recentAlerts: alertRows ?? [],
      recentLogs: logs.slice(0, 50),
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load usage' }, { status: 503 });
  }
}
