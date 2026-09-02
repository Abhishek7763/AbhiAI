import type { ProviderAdapter } from './base';
import { GoogleProvider } from './google';
import { OpenAICompatibleProvider } from './openai-compatible';

/**
 * Phase 5 intentionally exposes one production provider only.
 * Additional providers can be added after Google works end-to-end.
 */
export const PROVIDER_TEMPLATES = [
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'Google Gemini Developer API with current Flash models and free-tier safety checks.',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authType: 'api_key',
    isPreset: true,
    defaultModels: [
      { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', capabilities: ['text', 'vision', 'reasoning', 'fast'] },
      { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', capabilities: ['text', 'vision', 'fast'] },
      { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', capabilities: ['text', 'fast'] },
    ],
  },
] as const;

const dynamicAdapters = new Map<string, ProviderAdapter>();
dynamicAdapters.set('google', new GoogleProvider());

export function getProviderAdapter(id: string, customBaseUrl?: string): ProviderAdapter | null {
  const existing = dynamicAdapters.get(id);
  if (existing) return existing;

  if (customBaseUrl) {
    const customAdapter = new OpenAICompatibleProvider({
      id,
      name: 'Custom OpenAI-Compatible',
      baseUrl: customBaseUrl,
    });
    dynamicAdapters.set(id, customAdapter);
    return customAdapter;
  }

  return null;
}

export function getAllProviderAdapters(): ProviderAdapter[] {
  return Array.from(dynamicAdapters.values());
}
