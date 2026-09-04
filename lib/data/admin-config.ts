import 'server-only';

import { DEFAULT_AGENTS, type AIAgent } from '@/lib/agents';
import { DEFAULT_APP_SETTINGS, type AppSettings } from '@/lib/app-settings';
import type { AIModelConfig } from '@/lib/models';
import type { UsageEntry } from '@/lib/usage-logger';
import { createAdminClient } from '@/lib/supabase/admin';

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function getStoredSettings(): Promise<AppSettings> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('app_settings').select('key, value').in('key', ['general', 'limits']);
  throwIfError(error);
  const values = Object.fromEntries((data ?? []).map((row: any) => [row.key, row.value]));
  return {
    ...DEFAULT_APP_SETTINGS,
    ...(values.general ?? {}),
    ...(values.limits ?? {}),
    geminiApiKey: '',
    openaiApiKey: '',
    stabilityApiKey: '',
    openrouterApiKey: '',
    groqApiKey: '',
    togetherApiKey: '',
    lastUpdated: new Date().toISOString(),
  };
}

export async function saveStoredSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getStoredSettings();
  const updated = { ...current, ...settings, lastUpdated: new Date().toISOString() };
  const {
    geminiApiKey: _gemini,
    openaiApiKey: _openai,
    stabilityApiKey: _stability,
    openrouterApiKey: _openrouter,
    groqApiKey: _groq,
    togetherApiKey: _together,
    ...safeSettings
  } = updated;
  const supabase = createAdminClient();
  const { error } = await supabase.from('app_settings').upsert({
    key: 'general',
    value: safeSettings,
    description: 'AbhiAI application settings. Secrets are stored separately in ai_api_keys.',
  });
  throwIfError(error);
  return { ...updated, geminiApiKey: '', openaiApiKey: '', stabilityApiKey: '', openrouterApiKey: '', groqApiKey: '', togetherApiKey: '' };
}

export async function getStoredInstructions() {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('system_instructions').select('system_prompt').eq('id', 'global').single();
  throwIfError(error);
  if (!data) throw new Error('Global instructions were not found.');
  return { systemPrompt: data.system_prompt as string };
}

export async function saveStoredInstructions(systemPrompt: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('system_instructions').upsert({ id: 'global', system_prompt: systemPrompt });
  throwIfError(error);
}

function agentFromRow(row: any): AIAgent {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    systemPrompt: row.system_prompt,
    preferredModelOrAlias: row.preferred_model_alias ?? '',
    fallbackModelOrAlias: row.fallback_model_alias ?? undefined,
    requiredCapabilities: row.required_capabilities,
    allowedTools: Array.isArray(row.allowed_tools) ? row.allowed_tools : ['web_search', 'document_qa'],
    visibility: row.visibility,
    temperature: Number(row.temperature),
    sampleStarters: row.sample_starters,
    createdAt: row.created_at,
  };
}

export async function getStoredAgents(): Promise<AIAgent[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('ai_agents').select('*').order('created_at');
  throwIfError(error);
  if (data?.length) return data.map(agentFromRow);
  await saveStoredAgents(DEFAULT_AGENTS);
  return DEFAULT_AGENTS;
}

export async function saveStoredAgents(agents: AIAgent[]) {
  const supabase = createAdminClient();
  const rows = agents.map((agent) => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    icon: agent.icon,
    system_prompt: agent.systemPrompt,
    preferred_model_alias: agent.preferredModelOrAlias || null,
    fallback_model_alias: agent.fallbackModelOrAlias || null,
    required_capabilities: agent.requiredCapabilities,
    allowed_tools: agent.allowedTools ?? ['web_search', 'document_qa'],
    visibility: agent.visibility,
    temperature: agent.temperature,
    sample_starters: agent.sampleStarters,
  }));
  const { error: upsertError } = rows.length ? await supabase.from('ai_agents').upsert(rows) : { error: null };
  throwIfError(upsertError);
  const { data: existing, error: readError } = await supabase.from('ai_agents').select('id');
  throwIfError(readError);
  const keepIds = new Set(agents.map((agent) => agent.id));
  const staleIds = (existing ?? []).map((row: any) => row.id as string).filter((id) => !keepIds.has(id));
  if (staleIds.length) {
    const { error: deleteError } = await supabase.from('ai_agents').delete().in('id', staleIds);
    throwIfError(deleteError);
  }
}

export async function getStoredModels(): Promise<AIModelConfig[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ai_models')
    .select('id, model_id, name, alias, capabilities, is_active, is_public, is_free, ai_providers(slug)')
    .order('priority');
  throwIfError(error);
  return (data ?? []).map((row: any) => ({
    recordId: row.id,
    id: row.model_id,
    providerId: row.ai_providers?.slug ?? '',
    name: row.name,
    alias: row.alias ?? row.name,
    capabilities: row.capabilities,
    isActive: row.is_active,
    isPublic: row.is_public,
    isFree: row.is_free,
  }));
}

export async function updateStoredModel(recordId: string, updates: Partial<Pick<AIModelConfig, 'alias' | 'isActive' | 'isPublic'>>) {
  if (!recordId?.trim()) return null;

  const values: Record<string, unknown> = {};
  if (updates.alias !== undefined) values.alias = updates.alias;
  if (updates.isActive !== undefined) values.is_active = updates.isActive;
  if (updates.isPublic !== undefined) values.is_public = updates.isPublic;

  if (Object.keys(values).length === 0) {
    return (await getStoredModels()).find((model) => model.recordId === recordId) ?? null;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('ai_models').update(values).eq('id', recordId);
  throwIfError(error);
  return (await getStoredModels()).find((model) => model.recordId === recordId) ?? null;
}

export async function getStoredUsageLogs(): Promise<UsageEntry[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('usage_events')
    .select('*, ai_providers(name, slug), ai_models(name, model_id)')
    .order('created_at', { ascending: false })
    .limit(500);
  throwIfError(error);

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    timestamp: row.created_at,
    modelOrAlias: row.model_or_alias,
    executedModelName: row.ai_models?.name ?? undefined,
    executedModelId: row.ai_models?.model_id ?? undefined,
    connectionId: row.model_id ?? undefined,
    provider: row.ai_providers?.name ?? row.ai_providers?.slug ?? 'unknown',
    promptLength: row.prompt_length,
    responseLength: row.response_length,
    durationMs: row.duration_ms,
    failoverUsed: row.failover_used,
    isPublic: row.is_public,
    status: row.status === 'aborted' ? 'error' : row.status,
    errorCode: row.error_code ?? undefined,
  }));
}

export async function insertUsageEvent(entry: Omit<UsageEntry, 'id' | 'timestamp'>) {
  const supabase = createAdminClient();
  let providerRecordId: string | null = null;
  let apiKeyRecordId: string | null = null;
  let modelRecordId: string | null = null;

  if (entry.connectionId) {
    const { data: modelRow, error: modelError } = await supabase
      .from('ai_models')
      .select('id, provider_id, ai_providers(ai_api_keys(id, status, priority))')
      .eq('id', entry.connectionId)
      .maybeSingle();
    throwIfError(modelError);

    if (modelRow) {
      modelRecordId = modelRow.id;
      providerRecordId = modelRow.provider_id;
      const keys = ((modelRow as any).ai_providers?.ai_api_keys ?? [])
        .filter((key: any) => key.status === 'active')
        .sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));
      apiKeyRecordId = keys[0]?.id ?? null;
    }
  } else if (entry.provider && entry.provider !== 'all-failed' && entry.provider !== 'unknown') {
    const { data: providerRow, error: providerError } = await supabase
      .from('ai_providers')
      .select('id, ai_api_keys(id, status, priority)')
      .eq('slug', entry.provider)
      .maybeSingle();
    throwIfError(providerError);

    if (providerRow) {
      providerRecordId = providerRow.id;
      const keys = ((providerRow as any).ai_api_keys ?? [])
        .filter((key: any) => key.status === 'active')
        .sort((a: any, b: any) => (a.priority ?? 100) - (b.priority ?? 100));
      apiKeyRecordId = keys[0]?.id ?? null;
    }
  }

  const { error } = await supabase.from('usage_events').insert({
    provider_id: providerRecordId,
    api_key_id: apiKeyRecordId,
    model_id: modelRecordId,
    model_or_alias: entry.modelOrAlias,
    status: entry.status,
    prompt_length: entry.promptLength,
    response_length: entry.responseLength,
    duration_ms: entry.durationMs,
    failover_used: entry.failoverUsed,
    is_public: entry.isPublic,
    error_code: entry.errorCode ?? null,
  });
  throwIfError(error);
}
