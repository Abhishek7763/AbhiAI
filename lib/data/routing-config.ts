import 'server-only';

import { classifyModelBilling } from '@/lib/ai/free-guard';
import { clampFailoverAttempts, clampProviderTimeoutMs } from '@/lib/ai/failover';
import { createAdminClient } from '@/lib/supabase/admin';

export type RoutingConfig = {
  strategy: 'smart-auto';
  preferredModelRecordId: string | null;
  poolModelRecordIds: string[];
  strictPool: boolean;
  maxAttempts: number;
  providerTimeoutMs: number;
};

export type RoutingModelOption = {
  recordId: string;
  modelId: string;
  name: string;
  alias: string | null;
  providerId: string;
  providerName: string;
  isActive: boolean;
  isPublic: boolean;
  billingClassification: ReturnType<typeof classifyModelBilling>;
  runtimeEligible: boolean;
};

const DEFAULT_ROUTING_CONFIG: RoutingConfig = {
  strategy: 'smart-auto',
  preferredModelRecordId: null,
  poolModelRecordIds: [],
  strictPool: false,
  maxAttempts: 4,
  providerTimeoutMs: 35_000,
};

function sanitizeConfig(value: unknown): RoutingConfig {
  if (!value || typeof value !== 'object') return DEFAULT_ROUTING_CONFIG;
  const raw = value as Record<string, unknown>;
  const pool = Array.isArray(raw.poolModelRecordIds)
    ? raw.poolModelRecordIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];
  return {
    strategy: 'smart-auto',
    preferredModelRecordId:
      typeof raw.preferredModelRecordId === 'string' && raw.preferredModelRecordId.length > 0
        ? raw.preferredModelRecordId
        : null,
    poolModelRecordIds: Array.from(new Set(pool)),
    strictPool: raw.strictPool === true,
    maxAttempts: clampFailoverAttempts(raw.maxAttempts, 4),
    providerTimeoutMs: clampProviderTimeoutMs(raw.providerTimeoutMs),
  };
}

export async function getRoutingConfig(): Promise<RoutingConfig> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'routing')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return sanitizeConfig(data?.value);
}

export async function listRoutingModelOptions(): Promise<RoutingModelOption[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ai_models')
    .select('id, model_id, name, alias, is_active, is_public, priority, ai_providers(slug, name, is_active)')
    .order('priority', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row: any) => {
    const providerId = row.ai_providers?.slug ?? '';
    const billingClassification = classifyModelBilling(providerId, row.model_id);
    const runtimeEligible = Boolean(
      row.is_active &&
      row.ai_providers?.is_active &&
      (billingClassification === 'FREE_VERIFIED' || billingClassification === 'FREE_LIMITED'),
    );

    return {
      recordId: row.id,
      modelId: row.model_id,
      name: row.name,
      alias: row.alias ?? null,
      providerId,
      providerName: row.ai_providers?.name ?? providerId,
      isActive: row.is_active,
      isPublic: row.is_public,
      billingClassification,
      runtimeEligible,
    };
  });
}

export async function saveRoutingConfig(input: Partial<RoutingConfig>): Promise<RoutingConfig> {
  const options = await listRoutingModelOptions();
  const eligibleIds = new Set(options.filter((model) => model.runtimeEligible).map((model) => model.recordId));

  const requestedPool = Array.isArray(input.poolModelRecordIds)
    ? input.poolModelRecordIds.filter((id): id is string => typeof id === 'string')
    : [];
  const poolModelRecordIds = Array.from(new Set(requestedPool.filter((id) => eligibleIds.has(id))));

  const requestedPreferred =
    typeof input.preferredModelRecordId === 'string' && eligibleIds.has(input.preferredModelRecordId)
      ? input.preferredModelRecordId
      : null;

  if (requestedPreferred && !poolModelRecordIds.includes(requestedPreferred)) {
    poolModelRecordIds.unshift(requestedPreferred);
  }

  const config: RoutingConfig = {
    strategy: 'smart-auto',
    preferredModelRecordId: requestedPreferred,
    poolModelRecordIds,
    strictPool: input.strictPool === true && poolModelRecordIds.length > 0,
    maxAttempts: clampFailoverAttempts(input.maxAttempts, 4),
    providerTimeoutMs: clampProviderTimeoutMs(input.providerTimeoutMs),
  };

  const supabase = createAdminClient();
  const { error } = await supabase.from('app_settings').upsert({
    key: 'routing',
    value: config,
    description: 'AbhiAI Smart Auto model pool, failover attempt limit, provider timeout and strict-pool routing policy.',
  });
  if (error) throw new Error(error.message);

  return config;
}
