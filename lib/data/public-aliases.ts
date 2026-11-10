import 'server-only';

import { DEFAULT_PUBLIC_ALIASES } from '@/lib/constants/aliases';
import { createAdminClient } from '@/lib/supabase/admin';
import { listRoutingModelOptions } from '@/lib/data/routing-config';

export type PublicAliasMapping = {
  id: string;
  displayName: string;
  modelRecordId: string | null;
  enabled: boolean;
};

const DEFAULT_MAPPINGS: PublicAliasMapping[] = DEFAULT_PUBLIC_ALIASES.map((alias) => ({
  ...alias,
  modelRecordId: null,
  enabled: true,
}));

function sanitizeMappings(value: unknown): PublicAliasMapping[] {
  const raw = Array.isArray(value) ? value : [];
  const byId = new Map(raw.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object')).map((item) => [String(item.id || ''), item]));

  return DEFAULT_MAPPINGS.map((fallback) => {
    const item = byId.get(fallback.id);
    return {
      ...fallback,
      modelRecordId: typeof item?.modelRecordId === 'string' && item.modelRecordId ? item.modelRecordId : null,
      enabled: item?.enabled !== false,
    };
  });
}

export async function getPublicAliasMappings(): Promise<PublicAliasMapping[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'public_aliases').maybeSingle();
  if (error) throw new Error(error.message);
  return sanitizeMappings(data?.value);
}

export async function savePublicAliasMappings(input: unknown): Promise<PublicAliasMapping[]> {
  const options = await listRoutingModelOptions();
  const eligibleIds = new Set(options.filter((model) => model.runtimeEligible).map((model) => model.recordId));
  const sanitized = sanitizeMappings(input).map((mapping) => ({
    ...mapping,
    modelRecordId: mapping.modelRecordId && eligibleIds.has(mapping.modelRecordId) ? mapping.modelRecordId : null,
  }));

  const supabase = createAdminClient();
  const { error } = await supabase.from('app_settings').upsert({
    key: 'public_aliases',
    value: sanitized,
    description: 'Phase 9 public AbhiAI aliases mapped to private backend model records.',
  });
  if (error) throw new Error(error.message);
  return sanitized;
}

export async function resolvePublicAlias(aliasId: string): Promise<string | null> {
  if (!aliasId.startsWith('abhiai-')) return null;
  const [mappings, options] = await Promise.all([getPublicAliasMappings(), listRoutingModelOptions()]);
  const mapping = mappings.find((item) => item.id === aliasId && item.enabled && item.modelRecordId);
  if (!mapping?.modelRecordId) return null;
  const model = options.find((item) => item.recordId === mapping.modelRecordId && item.runtimeEligible);
  return model?.modelId ?? null;
}

export async function listPublicAliases() {
  const mappings = await getPublicAliasMappings();
  return mappings.filter((item) => item.enabled && item.modelRecordId).map(({ id, displayName }) => ({ id, name: displayName.replace(/\s*\([^)]*\)\s*$/, '') }));
}
