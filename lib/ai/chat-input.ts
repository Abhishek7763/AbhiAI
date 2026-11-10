import 'server-only';

export type SafeChatHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export const MAX_CHAT_REQUEST_BYTES = 5_500_000;
export const MAX_USER_MESSAGE_CHARS = 20_000;
const MAX_HISTORY_MESSAGES = 32;
const MAX_HISTORY_TOTAL_CHARS = 60_000;
const MAX_HISTORY_MESSAGE_CHARS = 12_000;

export function validateChatRequestSize(contentLengthHeader: string | null) {
  if (!contentLengthHeader) return null;
  const contentLength = Number(contentLengthHeader);
  if (!Number.isFinite(contentLength) || contentLength <= 0) return null;
  if (contentLength > MAX_CHAT_REQUEST_BYTES) {
    return `Chat request is too large. Keep the total request under about ${Math.floor(MAX_CHAT_REQUEST_BYTES / 1_000_000)} MB.`;
  }
  return null;
}

export function validateUserMessage(value: unknown) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') return 'Message must be plain text.';
  if (value.length > MAX_USER_MESSAGE_CHARS) {
    return `Message is too long. Keep a single message under ${MAX_USER_MESSAGE_CHARS.toLocaleString()} characters.`;
  }
  return null;
}

export function sanitizeChatHistory(value: unknown): SafeChatHistoryMessage[] {
  if (!Array.isArray(value) || value.length === 0) return [];

  const candidates = value
    .slice(-MAX_HISTORY_MESSAGES)
    .map((item: any): SafeChatHistoryMessage | null => {
      if (!item || (item.role !== 'user' && item.role !== 'assistant')) return null;
      const content = typeof item.content === 'string' ? item.content.slice(-MAX_HISTORY_MESSAGE_CHARS) : '';
      if (!content.trim()) return null;
      return { role: item.role, content };
    })
    .filter((item): item is SafeChatHistoryMessage => Boolean(item));

  const selected: SafeChatHistoryMessage[] = [];
  let totalChars = 0;

  for (let index = candidates.length - 1; index >= 0; index -= 1) {
    const item = candidates[index];
    const remaining = MAX_HISTORY_TOTAL_CHARS - totalChars;
    if (remaining <= 0) break;

    const content = item.content.length > remaining ? item.content.slice(-remaining) : item.content;
    selected.push({ ...item, content });
    totalChars += content.length;
  }

  return selected.reverse();
}
