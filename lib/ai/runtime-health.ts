import 'server-only';

import { diagnoseAIError } from '@/lib/ai/error-doctor';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/logger';

type RuntimeState = {
  cooldownUntil?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastErrorCode?: string | number | null;
  lastFailureReason?: string | null;
  consecutiveFailures?: number;
  lastLatencyMs?: number | null;
  avgLatencyMs?: number | null;
};

export type RuntimeRoutingSignal = {
  id: string;
  priority: number;
  capabilities: string[];
  cooldownUntil: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastErrorCode: string | number | null;
  lastFailureReason: string | null;
  consecutiveFailures: number;
  lastLatencyMs: number | null;
  avgLatencyMs: number | null;
};

function cooldownMsForError(code: string | number, failures: number) {
  if (code === 429) return 60_000;
  if (code === 401) return 5 * 60_000;
  if (code === 403) return 2 * 60_000;
  if (code === 404) return 10 * 60_000;
  if (code === 'TIMEOUT') return 20_000;
  return failures >= 2 ? 15_000 : 0;
}

async function readLimits(modelRecordId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ai_models')
    .select('limits')
    .eq('id', modelRecordId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.limits && typeof data.limits === 'object' ? data.limits : {}) as Record<string, any>;
}

function runtimeStateFromLimits(limits: unknown): RuntimeState {
  if (!limits || typeof limits !== 'object') return {};
  const runtime = (limits as Record<string, any>).runtime;
  return runtime && typeof runtime === 'object' ? runtime as RuntimeState : {};
}

function validNumber(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function runtimeCooldownUntil(limits: unknown): string | null {
  const value = runtimeStateFromLimits(limits).cooldownUntil;
  return typeof value === 'string' && value ? value : null;
}

export function isRuntimeModelCoolingDown(limits: unknown, now = Date.now()) {
  const until = runtimeCooldownUntil(limits);
  if (!until) return false;
  const timestamp = Date.parse(until);
  return Number.isFinite(timestamp) && timestamp > now;
}

export async function listRuntimeRoutingSignals(): Promise<RuntimeRoutingSignal[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ai_models')
    .select('id, priority, capabilities, limits')
    .eq('is_active', true);

  if (error) {
    logger.warn('Could not read runtime routing signals.', error.message);
    return [];
  }

  return (data ?? []).map((row: any) => {
    const runtime = runtimeStateFromLimits(row.limits);
    return {
      id: row.id,
      priority: Number.isFinite(Number(row.priority)) ? Number(row.priority) : 100,
      capabilities: Array.isArray(row.capabilities)
        ? row.capabilities.filter((item: unknown): item is string => typeof item === 'string')
        : [],
      cooldownUntil: typeof runtime.cooldownUntil === 'string' ? runtime.cooldownUntil : null,
      lastSuccessAt: typeof runtime.lastSuccessAt === 'string' ? runtime.lastSuccessAt : null,
      lastFailureAt: typeof runtime.lastFailureAt === 'string' ? runtime.lastFailureAt : null,
      lastErrorCode: runtime.lastErrorCode ?? null,
      lastFailureReason: typeof runtime.lastFailureReason === 'string' && runtime.lastFailureReason
        ? runtime.lastFailureReason
        : null,
      consecutiveFailures: Math.max(0, Number(runtime.consecutiveFailures || 0)),
      lastLatencyMs: validNumber(runtime.lastLatencyMs),
      avgLatencyMs: validNumber(runtime.avgLatencyMs),
    };
  });
}

export async function listCoolingRuntimeModelIds() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ai_models')
    .select('id, limits')
    .eq('is_active', true);

  if (error) {
    logger.warn('Could not read runtime model cooldowns.', error.message);
    return new Set<string>();
  }

  const now = Date.now();
  return new Set(
    (data ?? [])
      .filter((row: any) => isRuntimeModelCoolingDown(row.limits, now))
      .map((row: any) => row.id as string),
  );
}

export async function recordRuntimeModelSuccess(modelRecordId: string, latencyMs?: number) {
  try {
    const limits = await readLimits(modelRecordId);
    const previous = runtimeStateFromLimits(limits);
    const now = new Date().toISOString();
    const measuredLatency = validNumber(latencyMs);
    const previousAverage = validNumber(previous.avgLatencyMs);
    const avgLatencyMs = measuredLatency === null
      ? previousAverage
      : previousAverage === null
        ? Math.round(measuredLatency)
        : Math.round(previousAverage * 0.7 + measuredLatency * 0.3);

    const supabase = createAdminClient();
    const { error } = await supabase
      .from('ai_models')
      .update({
        limits: {
          ...limits,
          runtime: {
            ...previous,
            cooldownUntil: null,
            lastSuccessAt: now,
            lastErrorCode: null,
            lastFailureReason: null,
            consecutiveFailures: 0,
            lastLatencyMs: measuredLatency === null ? previous.lastLatencyMs ?? null : Math.round(measuredLatency),
            avgLatencyMs,
          },
        },
      })
      .eq('id', modelRecordId);

    if (error) throw new Error(error.message);
  } catch (error) {
    logger.warn('Could not persist runtime model success.', error);
  }
}

export async function recordRuntimeModelFailure(modelRecordId: string, error: unknown) {
  try {
    const limits = await readLimits(modelRecordId);
    const previous = runtimeStateFromLimits(limits);
    const message = error instanceof Error ? error.message : String(error || 'Unknown AI model error');
    const diagnosis = diagnoseAIError(message);
    const consecutiveFailures = Math.max(0, Number(previous.consecutiveFailures || 0)) + 1;
    const cooldownMs = cooldownMsForError(diagnosis.code, consecutiveFailures);
    const now = new Date();

    const supabase = createAdminClient();
    const { error: updateError } = await supabase
      .from('ai_models')
      .update({
        limits: {
          ...limits,
          runtime: {
            ...previous,
            cooldownUntil: cooldownMs > 0 ? new Date(now.getTime() + cooldownMs).toISOString() : null,
            lastFailureAt: now.toISOString(),
            lastErrorCode: diagnosis.code,
            lastFailureReason: diagnosis.userTitle,
            consecutiveFailures,
          },
        },
      })
      .eq('id', modelRecordId);

    if (updateError) throw new Error(updateError.message);
  } catch (persistError) {
    logger.warn('Could not persist runtime model failure.', persistError);
  }
}
