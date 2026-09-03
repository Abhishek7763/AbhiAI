import { insertUsageEvent } from './data/admin-config';
import { logger } from './logger';

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
  } catch (error) {
    logger.debug('Initial usage telemetry write failed; retrying once.', error);
  }

  await new Promise((resolve) => setTimeout(resolve, 200));
  try {
    await insertUsageEvent(entry);
  } catch (error) {
    logger.warn('Usage telemetry could not be persisted after retry.', error);
  }
}

export function logUsageEvent(entry: Omit<UsageEntry, 'id' | 'timestamp'>): Promise<void> {
  return persistUsageEvent(entry);
}
