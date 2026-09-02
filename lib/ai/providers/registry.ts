import { ProviderAdapter } from './base';
import { GoogleProvider } from './google';
import { OpenAICompatibleProvider } from './openai-compatible';

// Preset templates for zero-config onboarding for non-technical admin
export const PROVIDER_TEMPLATES = [
  {
    id: 'google',
    name: 'Google Gemini',
    description: 'High-speed multimodel AI with generous free-tier (15 RPM)',
    baseUrl: 'https://generativelanguage.googleapis.com',
    authType: 'api_key',
    isPreset: true,
    defaultModels: [
      { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', capabilities: ['text', 'vision', 'fast'] },
      { id: 'gemini-3.5-pro', name: 'Gemini 3.5 Pro', capabilities: ['text', 'vision', 'reasoning'] },
    ]
  },
  {
    id: 'nvidia',
    name: 'NVIDIA NIM Catalog',
    description: '1000 free API developer credits with Llama-3, DeepSeek-R1, Mistral',
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    authType: 'bearer',
    isPreset: true,
    defaultModels: [
      { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', capabilities: ['text', 'reasoning', 'coding'] },
      { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 Reasoning', capabilities: ['text', 'reasoning'] },
      { id: 'nvidia/llama-3.2-11b-vision-instruct', name: 'Llama 3.2 11B Vision', capabilities: ['text', 'vision'] },
      { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B (Super Fast)', capabilities: ['text', 'fast'] },
    ]
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    description: 'Unified AI gateway with 50+ free models (:free tagged)',
    baseUrl: 'https://openrouter.ai/api/v1',
    authType: 'bearer',
    isPreset: true,
    defaultModels: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', capabilities: ['text', 'reasoning'] },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', capabilities: ['text', 'reasoning', 'coding'] },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash (Free)', capabilities: ['text', 'vision', 'fast'] },
      { id: 'qwen/qwen-2.5-coder-32b-instruct:free', name: 'Qwen 2.5 Coder 32B (Free)', capabilities: ['text', 'coding'] },
    ]
  },
  {
    id: 'groq',
    name: 'Groq Cloud',
    description: 'Ultra-fast LPU inference free tier with Llama 3 & DeepSeek',
    baseUrl: 'https://api.groq.com/openai/v1',
    authType: 'bearer',
    isPreset: true,
    defaultModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B Versatile', capabilities: ['text', 'coding', 'fast'] },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant', capabilities: ['text', 'fast'] },
      { id: 'deepseek-r1-distill-llama-70b', name: 'DeepSeek R1 Distill 70B', capabilities: ['text', 'reasoning'] },
    ]
  },
  {
    id: 'together',
    name: 'Together AI',
    description: 'High-speed open source models API',
    baseUrl: 'https://api.together.xyz/v1',
    authType: 'bearer',
    isPreset: true,
    defaultModels: [
      { id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', name: 'Llama 3.1 70B Turbo', capabilities: ['text'] },
    ]
  },
  {
    id: 'openai-compatible',
    name: 'Custom OpenAI-Compatible',
    description: 'Any server following OpenAI API format (Ollama, LM Studio, vLLM, OmniRouter)',
    baseUrl: '',
    authType: 'bearer',
    isPreset: false,
    defaultModels: []
  }
];

const dynamicAdapters: Map<string, ProviderAdapter> = new Map();

// Initialize known standard adapters
dynamicAdapters.set('google', new GoogleProvider());
PROVIDER_TEMPLATES.filter(t => t.id !== 'google' && t.baseUrl).forEach(t => {
  dynamicAdapters.set(
    t.id,
    new OpenAICompatibleProvider({
      id: t.id,
      name: t.name,
      baseUrl: t.baseUrl,
      knownModels: t.defaultModels.map(m => ({ ...m, provider: t.id }))
    })
  );
});

export function getProviderAdapter(id: string, customBaseUrl?: string): ProviderAdapter | null {
  if (dynamicAdapters.has(id)) {
    return dynamicAdapters.get(id)!;
  }

  // If custom URL is provided for openai-compatible
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
