import type { ProviderAdapter } from './base';
import { GoogleProvider } from './google';
import { OpenAICompatibleProvider } from './openai-compatible';

export type ProviderTemplate = {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  authType: 'api_key';
  isPreset: boolean;
  requiresBaseUrl?: boolean;
  defaultModels: Array<{
    id: string;
    name: string;
    capabilities: string[];
  }>;
};

/**
 * Provider catalogue shown in Admin > Providers / Integrations.
 * Presets use OpenAI-compatible APIs unless a dedicated adapter exists.
 * Custom/OmniRouter entries deliberately require the admin to enter the
 * provider's current base URL instead of AbhiAI guessing a potentially stale URL.
 */
export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Gemini Developer API with native PDF/image support and live model discovery.',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authType: 'api_key',
    isPreset: true,
    defaultModels: [
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', capabilities: ['text', 'vision', 'reasoning', 'fast'] },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', capabilities: ['text', 'vision', 'fast', 'coding'] },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', capabilities: ['text', 'fast'] },
    ],
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM',
    description: 'NVIDIA developer inference API for Llama, Qwen, DeepSeek, Mistral and other hosted models.',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    authType: 'api_key',
    isPreset: true,
    defaultModels: [],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'One OpenAI-compatible gateway for many providers. AbhiAI Free Guard recognizes :free models.',
    baseUrl: 'https://openrouter.ai/api/v1',
    authType: 'api_key',
    isPreset: true,
    defaultModels: [],
  },
  {
    id: 'groq',
    name: 'Groq',
    description: 'Low-latency OpenAI-compatible inference with account-level free rate limits where available.',
    baseUrl: 'https://api.groq.com/openai/v1',
    authType: 'api_key',
    isPreset: true,
    defaultModels: [],
  },
  {
    id: 'together',
    name: 'Together AI',
    description: 'OpenAI-compatible model catalogue. Promotional/free availability is protected by Free Guard.',
    baseUrl: 'https://api.together.xyz/v1',
    authType: 'api_key',
    isPreset: true,
    defaultModels: [],
  },
  {
    id: 'cerebras',
    name: 'Cerebras',
    description: 'Fast OpenAI-compatible inference. Unknown model pricing remains blocked from public runtime.',
    baseUrl: 'https://api.cerebras.ai/v1',
    authType: 'api_key',
    isPreset: true,
    defaultModels: [],
  },
  {
    id: 'sambanova',
    name: 'SambaNova',
    description: 'OpenAI-compatible inference integration. Free Guard prevents accidental paid-model routing.',
    baseUrl: 'https://api.sambanova.ai/v1',
    authType: 'api_key',
    isPreset: true,
    defaultModels: [],
  },
  {
    id: 'omnirouter',
    name: 'OmniRouter',
    description: 'Connect an OmniRouter/OpenAI-compatible endpoint by entering its current API base URL.',
    baseUrl: '',
    authType: 'api_key',
    isPreset: false,
    requiresBaseUrl: true,
    defaultModels: [],
  },
  {
    id: 'custom',
    name: 'Custom OpenAI-Compatible',
    description: 'Connect any OpenAI-compatible provider with your own provider name, base URL and API key.',
    baseUrl: '',
    authType: 'api_key',
    isPreset: false,
    requiresBaseUrl: true,
    defaultModels: [],
  },
];

const dynamicAdapters = new Map<string, ProviderAdapter>();
dynamicAdapters.set('google', new GoogleProvider());

export function getProviderTemplate(id: string) {
  return PROVIDER_TEMPLATES.find((template) => template.id === id) ?? null;
}

export function getProviderAdapter(id: string, customBaseUrl?: string): ProviderAdapter | null {
  const existing = dynamicAdapters.get(id);
  if (existing) return existing;

  const template = getProviderTemplate(id);
  const baseUrl = customBaseUrl?.trim() || template?.baseUrl || '';
  if (!baseUrl) return null;

  const adapter = new OpenAICompatibleProvider({
    id,
    name: template?.name || id,
    baseUrl,
    knownModels: template?.defaultModels,
  });
  dynamicAdapters.set(id, adapter);
  return adapter;
}

export function getAllProviderAdapters(): ProviderAdapter[] {
  return Array.from(dynamicAdapters.values());
}
