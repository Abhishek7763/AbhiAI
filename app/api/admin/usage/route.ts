import { NextResponse } from 'next/server';
import { getUsageLogs } from '@/lib/usage-logger';

export async function GET() {
  const logs = getUsageLogs();

  // Aggregate stats
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

  // Breakdown by Model
  const modelUsage: Record<string, number> = {};
  logs.forEach(l => {
    modelUsage[l.modelOrAlias] = (modelUsage[l.modelOrAlias] || 0) + 1;
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
    modelBreakdown: Object.entries(modelUsage).map(([name, count]) => ({ name, count })),
    recentLogs: logs.slice(0, 50),
  });
}
