import 'server-only';

import { getStoredInstructions } from '@/lib/data/admin-config';
import { withTimeout } from '@/lib/ai/timeout';

const DEFAULT_RUNTIME_INSTRUCTIONS = 'You are AbhiAI, a helpful, intelligent AI assistant created by Abhishek.';
const INSTRUCTIONS_TIMEOUT_MS = 3_000;

export async function getRuntimeInstructions(): Promise<string> {
  try {
    const stored = await withTimeout(
      getStoredInstructions(),
      INSTRUCTIONS_TIMEOUT_MS,
      'Global instructions load',
    );
    const prompt = stored.systemPrompt?.trim();
    return prompt || DEFAULT_RUNTIME_INSTRUCTIONS;
  } catch (error) {
    console.warn(
      'Could not load stored global instructions; using safe fallback:',
      error instanceof Error ? error.message : error,
    );
    return DEFAULT_RUNTIME_INSTRUCTIONS;
  }
}
