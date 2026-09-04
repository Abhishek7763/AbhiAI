import 'server-only';

import { DEFAULT_AGENTS, type AIAgent, type AgentCapability, type AgentToolPermission } from '@/lib/agents';
import { createAdminClient } from '@/lib/supabase/admin';

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

function cleanCapabilities(value: unknown): AgentCapability[] {
  const allowed = new Set<AgentCapability>(['text', 'vision', 'coding', 'reasoning', 'fast']);
  return Array.isArray(value) ? value.filter((item): item is AgentCapability => allowed.has(item as AgentCapability)) : ['text'];
}

function cleanTools(value: unknown): AgentToolPermission[] {
  const allowed = new Set<AgentToolPermission>(['web_search', 'document_qa', 'image_generation']);
  return Array.isArray(value) ? value.filter((item): item is AgentToolPermission => allowed.has(item as AgentToolPermission)) : [];
}

function agentFromRow(row: any): AIAgent {
  const preferred = row.preferred_model_alias ?? '';
  const storedPool = Array.isArray(row.model_pool) ? row.model_pool.filter((item: unknown): item is string => typeof item === 'string' && item.trim().length > 0) : [];
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    icon: row.icon || 'bot',
    systemPrompt: row.system_prompt,
    preferredModelOrAlias: preferred,
    modelPool: storedPool.length > 0 ? storedPool : (preferred ? [preferred] : []),
    fallbackModelOrAlias: row.fallback_model_alias ?? undefined,
    requiredCapabilities: cleanCapabilities(row.required_capabilities),
    allowedTools: cleanTools(row.allowed_tools),
    visibility: row.visibility,
    temperature: Number(row.temperature),
    memoryEnabled: row.memory_enabled !== false,
    maxTokens: Number(row.max_tokens ?? 4096),
    sampleStarters: Array.isArray(row.sample_starters) ? row.sample_starters : [],
    createdAt: row.created_at,
  };
}

export async function getAgentConfigs(): Promise<AIAgent[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.from('ai_agents').select('*').order('created_at');
  throwIfError(error);
  if (data?.length) return data.map(agentFromRow);
  await saveAgentConfigs(DEFAULT_AGENTS);
  return DEFAULT_AGENTS;
}

export async function saveAgentConfigs(agents: AIAgent[]) {
  const supabase = createAdminClient();
  const rows = agents.map((agent) => ({
    id: agent.id,
    name: agent.name.trim(),
    description: agent.description.trim(),
    icon: agent.icon || 'bot',
    system_prompt: agent.systemPrompt.trim(),
    preferred_model_alias: agent.preferredModelOrAlias || null,
    model_pool: Array.from(new Set((agent.modelPool ?? []).filter(Boolean))),
    fallback_model_alias: agent.fallbackModelOrAlias || null,
    required_capabilities: cleanCapabilities(agent.requiredCapabilities),
    allowed_tools: cleanTools(agent.allowedTools),
    visibility: agent.visibility,
    temperature: Math.max(0, Math.min(2, Number(agent.temperature) || 0.7)),
    memory_enabled: agent.memoryEnabled !== false,
    max_tokens: Math.max(256, Math.min(32768, Number(agent.maxTokens) || 4096)),
    sample_starters: (agent.sampleStarters ?? []).map((item) => item.trim()).filter(Boolean),
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
