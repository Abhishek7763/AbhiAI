import { ChatMessage } from './base';

export interface StreamChunk {
  text?: string;
  isThinking?: boolean;
  done?: boolean;
  error?: string;
}

export async function* streamOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  customHeaders?: Record<string, string>
): AsyncGenerator<string, void, unknown> {
  const formattedMessages: any[] = [];
  if (systemPrompt) {
    formattedMessages.push({ role: 'system', content: systemPrompt });
  }

  for (const msg of messages) {
    if (msg.attachments && msg.attachments.length > 0) {
      const contentParts: any[] = [{ type: 'text', text: msg.content }];
      for (const att of msg.attachments) {
        if (att.type.startsWith('image/')) {
          contentParts.push({
            type: 'image_url',
            image_url: {
              url: att.data.startsWith('data:') ? att.data : `data:${att.type};base64,${att.data}`,
            },
          });
        }
      }
      formattedMessages.push({ role: msg.role, content: contentParts });
    } else {
      formattedMessages.push({ role: msg.role, content: msg.content });
    }
  }

  const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    ...customHeaders,
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: formattedMessages,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Provider API error (${res.status}): ${errorText.slice(0, 200)}`);
  }

  if (!res.body) {
    throw new Error('Response body is null');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data:')) continue;
      const dataStr = trimmed.replace(/^data:\s*/, '');
      if (dataStr === '[DONE]') return;

      try {
        const parsed = JSON.parse(dataStr);
        const delta = parsed.choices?.[0]?.delta?.content || '';
        if (delta) {
          yield delta;
        }
      } catch {
        // Skip incomplete or parse-error JSON chunks
      }
    }
  }
}
