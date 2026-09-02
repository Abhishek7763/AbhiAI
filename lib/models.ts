import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'models.json');

export interface AIModelConfig {
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
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading models config:', error);
  }
  
  // Default seed data
  const defaultModels: Record<string, AIModelConfig> = {
    'gemini-3.5-flash': {
      id: 'gemini-3.5-flash',
      providerId: 'google',
      name: 'Gemini 3.5 Flash',
      alias: 'AbhiAI Fast',
      capabilities: ['text', 'vision'],
      isActive: true,
      isPublic: true,
      isFree: true
    },
    'gemini-3.5-pro': {
      id: 'gemini-3.5-pro',
      providerId: 'google',
      name: 'Gemini 3.5 Pro',
      alias: 'AbhiAI Think',
      capabilities: ['text', 'vision', 'reasoning'],
      isActive: true,
      isPublic: true,
      isFree: true
    }
  };
  
  saveModels(defaultModels);
  return defaultModels;
}

export function saveModels(models: Record<string, AIModelConfig>) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(models, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving models config:', error);
    return false;
  }
}

export function getPublicModels(): AIModelConfig[] {
  const models = getModels();
  return Object.values(models).filter(m => m.isActive && m.isPublic);
}

export function getModelByIdOrAlias(identifier: string): AIModelConfig | null {
  const models = getModels();
  
  // Try by ID first
  if (models[identifier]) return models[identifier];
  
  // Try by alias
  const byAlias = Object.values(models).find(m => m.alias === identifier);
  if (byAlias) return byAlias;
  
  return null;
}
