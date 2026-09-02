import { insertUsageEvent } from './data/admin-config';

export interface UsageEntry {
  id: string;
  timestamp: string;
  modelOrAlias: string;
  executedModelName?: string;
  executedModelId?: string;
  connectionId?: string;
  provider: string;
  promptLength: number;
  responseLength: number;
  durationMs: number;
  failoverUsed: boolean;
  isPublic: boolean;
  status: 'success' | 'error';
  errorCode?: string;
  ip?: string;
}

async function persistUsageEvent(entry: Omit<UsageEntry, 'id' | 'timestamp'>) {
  try {
    await insertUsageEvent(entry);
    return;
  } catch {
    // One short retry absorbs transient Supabase/network hiccups without blocking chat execution.
  }

  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    await insertUsageEvent(entry);
  } catch (error) {
    console.warn('Usage telemetry could not be persisted:', error instanceof Error ? error.message : error);
  }
}

export function logUsageEvent(entry: Omit<UsageEntry, 'id' | 'timestamp'>): void {
  void persistUsageEvent(entry);
}
