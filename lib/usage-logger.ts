import { readJsonFile, writeJsonFile } from './config/file-store';

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

const USAGE_FILE = 'usage-logs.json';

export function logUsageEvent(entry: Omit<UsageEntry, 'id' | 'timestamp'>): void {
  const logs = getUsageLogs();
  const newEntry: UsageEntry = {
    ...entry,
    id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  // Phase 2 moves usage events to Supabase. Until then, Vercel skips this
  // best-effort local write instead of throwing EROFS runtime errors.
  writeJsonFile(USAGE_FILE, [newEntry, ...logs].slice(0, 500));
}

export function getUsageLogs(): UsageEntry[] {
  const parsed = readJsonFile<UsageEntry[]>(USAGE_FILE);
  return Array.isArray(parsed) ? parsed : [];
}
