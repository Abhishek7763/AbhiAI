import { readJsonFile, writeJsonFile } from './config/file-store';

const CONFIG_FILE = 'providers.json';

export interface ProviderConfig {
  id: string;
  apiKey: string;
  isActive: boolean;
}

export function getProviders(): Record<string, ProviderConfig> {
  return readJsonFile<Record<string, ProviderConfig>>(CONFIG_FILE) ?? {};
}

export function saveProviders(providers: Record<string, ProviderConfig>) {
  return writeJsonFile(CONFIG_FILE, providers);
}

export function getActiveProvider(): ProviderConfig | null {
  const providers = getProviders();
  const active = Object.values(providers).find(p => p.isActive);
  if (active) return active;
  
  // Fallback to first configured provider if none is explicitly active
  const anyConfigured = Object.values(providers).find(p => p.apiKey);
  return anyConfigured || null;
}
