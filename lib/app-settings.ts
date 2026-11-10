import { readJsonFile, writeJsonFile } from './config/file-store';

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

const SETTINGS_FILE = 'app-settings.json';

export function getAppSettings(): AppSettings {
  const storedSettings = readJsonFile<Partial<AppSettings>>(SETTINGS_FILE);
  return storedSettings
    ? { ...DEFAULT_APP_SETTINGS, ...storedSettings }
    : DEFAULT_APP_SETTINGS;
}

export function saveAppSettings(settings: Partial<AppSettings>): AppSettings | null {
  const updated = {
    ...getAppSettings(),
    ...settings,
    lastUpdated: new Date().toISOString(),
  };
  return writeJsonFile(SETTINGS_FILE, updated) ? updated : null;
}
