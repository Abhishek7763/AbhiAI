import { readJsonFile, writeJsonFile } from './config/file-store';

const CONFIG_FILE = 'models.json';

export interface AIModelConfig {
  recordId?: string; // Unique database record ID for provider-specific model management
  id: string; // The backend model ID (e.g., gemini-3.5-flash)
  providerId: string; // The provider ID (e.g., google)
  name: string; // Original name from provider
  alias: string; // User-facing name (e.g., AbhiAI Fast)
  capabilities: string[];
  isActive: boolean; // Enabled for use
  isPublic: boolean; // Visible on public chat
  isFree: boolean;
}

export function getModels(): Record<string, AIModelConfig> {
  const storedModels = readJsonFile<Record<string, AIModelConfig>>(CONFIG_FILE);
  if (storedModels) return storedModels;

  const defaultModels: Record<string, AIModelConfig> = {
    'gemini-3.5-flash': {
      id: 'gemini-3.5-flash',
      providerId: 'google',
      name: 'Gemini 3.5 Flash',
      alias: 'AbhiAI Fast',
      capabilities: ['text', 'vision'],
      isActive: true,
      isPublic: true,
      isFree: true,
    },
    'gemini-3.5-pro': {
      id: 'gemini-3.5-pro',
      providerId: 'google',
      name: 'Gemini 3.5 Pro',
      alias: 'AbhiAI Think',
      capabilities: ['text', 'vision', 'reasoning'],
      isActive: true,
      isPublic: true,
      isFree: true,
    },
  };

  saveModels(defaultModels);
  return defaultModels;
}

export function saveModels(models: Record<string, AIModelConfig>) {
  return writeJsonFile(CONFIG_FILE, models);
}

export function getPublicModels(): AIModelConfig[] {
  const models = getModels();
  return Object.values(models).filter((model) => model.isActive && model.isPublic);
}

export function getModelByIdOrAlias(identifier: string): AIModelConfig | null {
  const models = getModels();
  if (models[identifier]) return models[identifier];

  const byAlias = Object.values(models).find((model) => model.alias === identifier);
  return byAlias ?? null;
}
