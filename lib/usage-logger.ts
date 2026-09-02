import { insertUsageEvent } from './data/admin-config';

export interface UsageEntry {
  id: string;
  timestamp: string;
  modelOrAlias: string;
  provider: string;
  promptLength: number;
  responseLength: number;
  durationMs: number;
  failoverUsed: boolean;
  isPublic: boolean;
  status: 'success' | 'error';
  ip?: string;
}

export function logUsageEvent(entry: Omit<UsageEntry, 'id' | 'timestamp'>): void {
  void insertUsageEvent(entry).catch((error) => {
    console.error('Failed to persist usage event:', error instanceof Error ? error.message : error);
  });
}
