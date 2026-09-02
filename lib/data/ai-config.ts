import 'server-only';

import type { AIConnection } from '@/lib/connections';
import { classifyModelBilling } from '@/lib/ai/free-guard';
import { encryptApiKey } from '@/lib/security/api-key-crypto';
import { createAdminClient } from '@/lib/supabase/admin';

type ConnectionInput = Partial<AIConnection> & {
  providerId?: string;
  providerName?: string;
  keyLabel?: string;
};

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'custom';
}

function adapterType(slug: string, baseUrl: string): 'google' | 'openai-compatible' {
  return slug === 'google' || baseUrl.includes('googleapis.com') ? 'google' : 'openai-compatible';
}

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

export async function upsertProvider(input: {
  slug: string;
  name: string;
  baseUrl: string;
  isActive?: boolean;
  apiKey?: string;
  keyLabel?: string;
}) {
  const supabase = createAdminClient();
  const slug = slugify(input.slug);
  const { data: provider, error } = await supabase
    .from('ai_providers')
    .upsert({
      slug,
      name: input.name,
      base_url: input.baseUrl,
      adapter_type: adapterType(slug, input.baseUrl),
      is_active: input.isActive ?? true,
    }, { onConflict: 'slug' })
    .select('id, slug, name, base_url, is_active')
    .single();
  throwIfError(error);
  if (!provider) throw new Error('Provider could not be saved.');

  if (input.apiKey?.trim()) {
    const encrypted = encryptApiKey(input.apiKey);
    const { error: keyError } = await supabase.from('ai_api_keys').upsert({
      provider_id: provider.id,
      label: input.keyLabel?.trim() || `${provider.name} key`,
      encrypted_key: encrypted.encryptedKey,
      encryption_iv: encrypted.iv,
      encryption_tag: encrypted.tag,
      encryption_version: encrypted.version,
      key_fingerprint: encrypted.fingerprint,
      masked_key: encrypted.maskedKey,
      status: 'active',
    }, { onConflict: 'provider_id,key_fingerprint' });
    throwIfError(keyError);
  }

  return provider;
}

export async function listProviders() {
  const supabase = createAdminClient();
  const { data: providers, error } = await supabase
    .from('ai_providers')
    .select('id, slug, name, base_url, is_active, ai_api_keys(id, label, masked_key, status, priority)')
    .order('priority');
  throwIfError(error);
  return providers ?? [];
}

export async function listConnections(): Promise<AIConnection[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('ai_models')
    .select('id, model_id, name, alias, capabilities, is_active, is_public, ai_providers(id, slug, name, base_url, ai_api_keys(id, label, masked_key, status))')
    .order('priority');
  throwIfError(error);

  return (data ?? []).map((row: any) => {
    const activeKeys = (row.ai_providers?.ai_api_keys ?? []).filter((key: any) => key.status === 'active');
    return {
      id: row.id,
      scope: row.is_public ? 'public' : 'personal',
      assignedAlias: row.alias || undefined,
      name: row.name,
      baseUrl: row.ai_providers?.base_url ?? '',
      apiKey: '',
      hasApiKey: activeKeys.length > 0,
      maskedApiKey: activeKeys[0]?.masked_key,
      apiKeyCount: activeKeys.length,
      providerId: row.ai_providers?.slug,
      modelId: row.model_id,
      systemPrompt: '',
      isActive: row.is_active,
    };
  });
}

export async function saveConnection(input: ConnectionInput): Promise<AIConnection> {
  if (!input.name?.trim() || !input.modelId?.trim() || !input.baseUrl?.trim()) {
    throw new Error('Name, model ID, and base URL are required.');
  }

  const hostname = new URL(input.baseUrl).hostname;
  const inferredProvider = input.providerId || (hostname.includes('googleapis.com') ? 'google' : hostname.split('.').slice(-2, -1)[0]) || input.name;
  const provider = await upsertProvider({
    slug: inferredProvider,
    name: input.providerName || slugify(inferredProvider).replace(/-/g, ' '),
    baseUrl: input.baseUrl,
    isActive: input.isActive,
    apiKey: input.apiKey,
    keyLabel: input.keyLabel,
  });

  const billing = classifyModelBilling(provider.slug, input.modelId);
  const verifiedFree = billing === 'FREE_VERIFIED' || billing === 'FREE_LIMITED';

  const supabase = createAdminClient();
  const values = {
    provider_id: provider.id,
    model_id: input.modelId,
    name: input.name,
    alias: input.assignedAlias || null,
    is_active: input.isActive ?? true,
    is_public: input.scope !== 'personal',
    is_free: verifiedFree,
  };

  const query = input.id
    ? supabase.from('ai_models').update(values).eq('id', input.id)
    : supabase.from('ai_models').upsert(values, { onConflict: 'provider_id,model_id' });
  const { data: model, error } = await query.select('id').single();
  throwIfError(error);
  if (!model) throw new Error('Model could not be saved.');

  if (input.systemPrompt !== undefined) {
    const { error: promptError } = await supabase.from('system_instructions').upsert({
      id: `model:${model.id}`,
      system_prompt: input.systemPrompt,
    });
    throwIfError(promptError);
  }

  const saved = (await listConnections()).find((item) => item.id === model.id);
  if (!saved) throw new Error('Connection was saved but could not be reloaded.');
  return saved;
}

export async function deleteConnection(id: string) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('ai_models').delete().eq('id', id);
  throwIfError(error);
}
