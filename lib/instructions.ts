import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'instructions.json');

export interface InstructionsConfig {
  systemPrompt: string;
}

export function getInstructions(): InstructionsConfig {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading instructions config:', error);
  }
  return { systemPrompt: 'You are AbhiAI, a helpful, intelligent AI assistant created by Abhishek.' };
}

export function saveInstructions(config: InstructionsConfig) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving instructions config:', error);
    return false;
  }
}
