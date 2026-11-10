import { readJsonFile, writeJsonFile } from './config/file-store';

const CONFIG_FILE = 'instructions.json';

export interface InstructionsConfig {
  systemPrompt: string;
}

export function getInstructions(): InstructionsConfig {
  return readJsonFile<InstructionsConfig>(CONFIG_FILE) ?? {
    systemPrompt: 'You are AbhiAI, a helpful, intelligent AI assistant created by Abhishek.',
  };
}

export function saveInstructions(config: InstructionsConfig) {
  return writeJsonFile(CONFIG_FILE, config);
}
