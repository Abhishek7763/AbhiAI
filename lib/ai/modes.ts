export type AbhiAIMode = 'think' | 'code' | 'fast' | 'lite' | 'general';

interface ModeCandidate {
  name?: string;
  modelId?: string;
}

export function resolveAbhiAIMode(candidate: ModeCandidate): AbhiAIMode {
  const name = (candidate.name || '').toLowerCase();
  const modelId = (candidate.modelId || '').toLowerCase();

  if (name.includes('think') || name.includes('reason')) return 'think';
  if (name.includes('code') || name.includes('developer')) return 'code';
  if (name.includes('fast') || name.includes('quick')) return 'fast';
  if (name.includes('lite') || name.includes('mini')) return 'lite';

  // Stable default behavior for the four current AbhiAI model slots even if
  // their public display names are customized from Admin > Models.
  if (modelId === 'gemini-3.7-flash') return 'think';
  if (modelId === 'gemini-3.6-flash') return 'code';
  if (modelId === 'gemini-3.5-flash-lite') return 'fast';
  if (modelId === 'gemini-3.1-flash-lite') return 'lite';

  return 'general';
}

export function getAbhiAIModeInstruction(candidate: ModeCandidate): string {
  switch (resolveAbhiAIMode(candidate)) {
    case 'think':
      return [
        'ABHIAI MODE: THINK.',
        'For complex questions, reason carefully and verify assumptions before answering.',
        'Give the user the useful conclusions, checks, tradeoffs, and steps without exposing private chain-of-thought.',
        'Prefer correctness and depth over rushing, while staying concise when the question is simple.',
      ].join(' ');
    case 'code':
      return [
        'ABHIAI MODE: CODE.',
        'Prioritize technically correct, maintainable, runnable code and practical debugging.',
        'Preserve the user’s existing architecture and working behavior unless a change is necessary.',
        'When editing code, explain the important change briefly, account for edge cases, and prefer solutions that can be tested.',
      ].join(' ');
    case 'fast':
      return [
        'ABHIAI MODE: FAST.',
        'Answer quickly and directly. Lead with the result, keep reasoning compact, and avoid unnecessary sections or repetition.',
        'Do not sacrifice factual correctness for brevity.',
      ].join(' ');
    case 'lite':
      return [
        'ABHIAI MODE: LITE.',
        'Use a lightweight response style: simple language, short answers, minimal formatting, and only the details needed to solve the request.',
        'Ask a clarifying question only when the missing information truly blocks a useful answer.',
      ].join(' ');
    default:
      return 'ABHIAI MODE: GENERAL. Be accurate, helpful, clear, and adapt the response depth to the user’s request.';
  }
}
