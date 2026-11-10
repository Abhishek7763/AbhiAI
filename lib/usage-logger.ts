import { insertUsageEvent } from './data/admin-config';
import { logger } from './logger';
import { evaluateOpsAlerts } from './ops-alerts';

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
  let persisted = false;
  try {
    await insertUsageEvent(entry);
    persisted = true;
  } catch (error) {
    logger.debug('Initial usage telemetry write failed; retrying once.', error);
  }

  if (!persisted) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    try {
      await insertUsageEvent(entry);
      persisted = true;
    } catch (error) {
      logger.warn('Usage telemetry could not be persisted after retry.', error);
    }
  }

  if (persisted) {
    await evaluateOpsAlerts({
      provider: entry.provider,
      connectionId: entry.connectionId,
      status: entry.status,
    });
  }
}

export function logUsageEvent(entry: Omit<UsageEntry, 'id' | 'timestamp'>): Promise<void> {
  return persistUsageEvent(entry);
}
