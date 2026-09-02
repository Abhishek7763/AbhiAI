import 'server-only';

import { diagnoseAIError } from '@/lib/ai/error-doctor';
import { createAdminClient } from '@/lib/supabase/admin';

type RuntimeState = {
  cooldownUntil?: string | null;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  lastErrorCode?: string | number | null;
  consecutiveFailures?: number;
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

export function runtimeCooldownUntil(limits: unknown): string | null {
  if (!limits || typeof limits !== 'object') return null;
  const runtime = (limits as Record<string, any>).runtime;
  const value = runtime?.cooldownUntil;
  return typeof value === 'string' && value ? value : null;
}

export function isRuntimeModelCoolingDown(limits: unknown, now = Date.now()) {
  const until = runtimeCooldownUntil(limits);
  if (!until) return false;
  const timestamp = Date.parse(until);
  return Number.isFinite(timestamp) && timestamp > now;
}

export async function recordRuntimeModelSuccess(modelRecordId: string) {
  try {
    const limits = await readLimits(modelRecordId);
    const previous = (limits.runtime && typeof limits.runtime === 'object' ? limits.runtime : {}) as RuntimeState;
    const now = new Date().toISOString();

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
            consecutiveFailures: 0,
          },
        },
      })
      .eq('id', modelRecordId);

    if (error) throw new Error(error.message);
  } catch (error) {
    console.warn('Could not persist runtime model success:', error instanceof Error ? error.message : error);
  }
}

export async function recordRuntimeModelFailure(modelRecordId: string, error: unknown) {
  try {
    const limits = await readLimits(modelRecordId);
    const previous = (limits.runtime && typeof limits.runtime === 'object' ? limits.runtime : {}) as RuntimeState;
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
            consecutiveFailures,
          },
        },
      })
      .eq('id', modelRecordId);

    if (updateError) throw new Error(updateError.message);
  } catch (persistError) {
    console.warn('Could not persist runtime model failure:', persistError instanceof Error ? persistError.message : persistError);
  }
}
