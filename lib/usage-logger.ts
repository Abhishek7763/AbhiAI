import fs from 'fs';
import path from 'path';

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

const USAGE_FILE = path.join(process.cwd(), 'usage-logs.json');

export function logUsageEvent(entry: Omit<UsageEntry, 'id' | 'timestamp'>): void {
  try {
    const logs = getUsageLogs();
    const newEntry: UsageEntry = {
      ...entry,
      id: `use-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(newEntry);
    // Keep max 500 logs locally
    const trimmed = logs.slice(0, 500);
    fs.writeFileSync(USAGE_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  } catch (err) {
    console.error('Error recording usage log:', err);
  }
}

export function getUsageLogs(): UsageEntry[] {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const data = fs.readFileSync(USAGE_FILE, 'utf8');
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.error('Error reading usage logs:', err);
  }
  return [];
}
