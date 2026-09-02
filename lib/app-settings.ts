import fs from 'fs';
import path from 'path';

export interface AppSettings {
  appName: string;
  creatorName: string;
  freeOnlyMode: boolean;
  rateLimitRPM: number;
  maxDailyRequestsPerIP: number;
  maxPromptLength: number;
  enablePublicAI: boolean;
  enablePWA: boolean;
  defaultPublicAlias: string;
  defaultPrivateModel: string;
  supportEmail: string;
  // Dynamic API Keys manageable from Admin Panel
  geminiApiKey?: string;
  openaiApiKey?: string;
  stabilityApiKey?: string;
  openrouterApiKey?: string;
  groqApiKey?: string;
  togetherApiKey?: string;
  customImageApiEndpoint?: string;
  lastUpdated: string;
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  appName: 'AbhiAI',
  creatorName: 'Abhishek',
  freeOnlyMode: true,
  rateLimitRPM: 30,
  maxDailyRequestsPerIP: 200,
  maxPromptLength: 4000,
  enablePublicAI: true,
  enablePWA: true,
  defaultPublicAlias: 'abhiai-fast',
  defaultPrivateModel: '',
  supportEmail: 'abhishekbhardwaj7763@gmail.com',
  geminiApiKey: '',
  openaiApiKey: '',
  stabilityApiKey: '',
  openrouterApiKey: '',
  groqApiKey: '',
  togetherApiKey: '',
  customImageApiEndpoint: '',
  lastUpdated: new Date().toISOString(),
};

const SETTINGS_FILE = path.join(process.cwd(), 'app-settings.json');

export function getAppSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, 'utf8');
      return { ...DEFAULT_APP_SETTINGS, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error reading app-settings.json:', err);
  }
  return DEFAULT_APP_SETTINGS;
}

export function saveAppSettings(settings: Partial<AppSettings>): AppSettings {
  try {
    const current = getAppSettings();
    const updated = {
      ...current,
      ...settings,
      lastUpdated: new Date().toISOString(),
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(updated, null, 2), 'utf8');
    return updated;
  } catch (err) {
    console.error('Error saving app-settings.json:', err);
    return DEFAULT_APP_SETTINGS;
  }
}
