import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'providers.json');

export interface ProviderConfig {
  id: string;
  apiKey: string;
  isActive: boolean;
}

export function getProviders(): Record<string, ProviderConfig> {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading providers config:', error);
  }
  return {};
}

export function saveProviders(providers: Record<string, ProviderConfig>) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(providers, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving providers config:', error);
    return false;
  }
}

export function getActiveProvider(): ProviderConfig | null {
  const providers = getProviders();
  const active = Object.values(providers).find(p => p.isActive);
  if (active) return active;
  
  // Fallback to first configured provider if none is explicitly active
  const anyConfigured = Object.values(providers).find(p => p.apiKey);
  return anyConfigured || null;
}
