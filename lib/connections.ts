import fs from 'fs';
import path from 'path';
import { getAppSettings } from './app-settings';

export interface AIConnection {
  id: string;
  scope: 'public' | 'personal';
  assignedAlias?: string; // For public: 'AbhiAI Chat', 'AbhiAI Code', 'AbhiAI Reason'. For personal: custom display name
  name: string; // Internal name e.g. 'Google Gemini 2.5 Flash'
  baseUrl: string;
  apiKey: string;
  modelId: string;
  systemPrompt: string;
  isActive: boolean;
}

const CONNECTIONS_FILE = path.join(process.cwd(), 'connections.json');

function getDefaultConnections(): Record<string, AIConnection> {
  const appSettings = getAppSettings();
  const geminiKey = appSettings.geminiApiKey || process.env.GEMINI_API_KEY || '';

  return {
    'gemini-flash': {
      id: 'gemini-flash',
      scope: 'public',
      assignedAlias: 'abhiai-fast',
      name: 'Gemini 2.5 Flash',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: geminiKey,
      modelId: 'gemini-2.5-flash',
      systemPrompt: 'You are AbhiAI, a fast, helpful, and intelligent assistant created by Abhishek. Provide accurate, structured, and helpful responses.',
      isActive: true,
    },
    'gemini-pro': {
      id: 'gemini-pro',
      scope: 'public',
      assignedAlias: 'abhiai-reasoning',
      name: 'Gemini 2.5 Pro',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: geminiKey,
      modelId: 'gemini-2.5-pro',
      systemPrompt: 'You are AbhiAI Pro, an advanced reasoning and coding AI created by Abhishek. Analyze problems deeply with high precision.',
      isActive: true,
    },
    'gemini-thinking': {
      id: 'gemini-thinking',
      scope: 'public',
      assignedAlias: 'abhiai-thinking',
      name: 'Gemini 2.5 Flash Thinking',
      baseUrl: 'https://generativelanguage.googleapis.com',
      apiKey: geminiKey,
      modelId: 'gemini-2.5-flash',
      systemPrompt: 'You are AbhiAI Thinking, specialized in step-by-step logic, math, and architecture.',
      isActive: true,
    },
  };
}

export function getConnections(): Record<string, AIConnection> {
  try {
    if (fs.existsSync(CONNECTIONS_FILE)) {
      const data = fs.readFileSync(CONNECTIONS_FILE, 'utf-8');
      const parsed = JSON.parse(data);
      if (parsed && Object.keys(parsed).length > 0) {
        // If an entry lacks apiKey, fallback to process.env.GEMINI_API_KEY if applicable
        const envKey = process.env.GEMINI_API_KEY || '';
        for (const key of Object.keys(parsed)) {
          if (!parsed[key].apiKey && parsed[key].providerId === 'google' && envKey) {
            parsed[key].apiKey = envKey;
          }
        }
        return parsed;
      }
    }
  } catch (error) {
    console.error('Failed to read connections:', error);
  }
  return getDefaultConnections();
}

export function saveConnections(connections: Record<string, AIConnection>) {
  try {
    fs.writeFileSync(CONNECTIONS_FILE, JSON.stringify(connections, null, 2));
  } catch (error) {
    console.warn('Failed to save connections to disk (may be read-only on Vercel):', error);
  }
}

