import { NextResponse } from 'next/server';
import { getStoredUsageLogs } from '@/lib/data/admin-config';

export async function GET() {
  let logs;
  try {
    logs = await getStoredUsageLogs();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load usage' }, { status: 503 });
  }

  const totalRequests = logs.length;
  const successfulRequests = logs.filter(l => l.status === 'success').length;
  const failedRequests = logs.filter(l => l.status === 'error').length;
  const failoverEvents = logs.filter(l => l.failoverUsed).length;

  const totalTokensEstimated = logs.reduce((acc, l) => {
    return acc + Math.ceil((l.promptLength + l.responseLength) / 4);
  }, 0);

  const avgLatency = logs.length > 0
    ? Math.round(logs.reduce((acc, l) => acc + l.durationMs, 0) / logs.length)
    : 0;

  const modelUsage: Record<string, number> = {};
  logs.forEach(l => {
    const modelName = l.executedModelName || l.modelOrAlias;
    modelUsage[modelName] = (modelUsage[modelName] || 0) + 1;
  });

  return NextResponse.json({
    stats: {
      totalRequests,
      successfulRequests,
      failedRequests,
      failoverEvents,
      totalTokensEstimated,
      avgLatency,
    },
    modelBreakdown: Object.entries(modelUsage)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
    recentLogs: logs.slice(0, 50),
  });
}
