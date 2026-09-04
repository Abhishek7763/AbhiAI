import { ChatMessage } from './providers/base';

export interface StreamChunk {
  text?: string;
  isThinking?: boolean;
  done?: boolean;
  error?: string;
}

export interface StreamRuntimeOptions {
  temperature?: number;
  maxTokens?: number;
}

const OPENAI_STREAM_FIRST_RESPONSE_MS = 25_000;
const OPENAI_STREAM_IDLE_MS = 30_000;
const OPENAI_STREAM_TOTAL_MS = 90_000;

export async function* streamOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  modelId: string,
  messages: ChatMessage[],
  systemPrompt?: string,
  customHeaders?: Record<string, string>,
  externalSignal?: AbortSignal,
  runtime?: StreamRuntimeOptions,
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

  const controller = new AbortController();
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let abortReason: 'client' | 'first' | 'idle' | 'total' | null = null;
  let firstResponseSeen = false;

  const abortFor = (reason: typeof abortReason) => {
    if (controller.signal.aborted) return;
    abortReason = reason;
    controller.abort();
  };

  const onExternalAbort = () => abortFor('client');
  if (externalSignal) {
    if (externalSignal.aborted) abortFor('client');
    else externalSignal.addEventListener('abort', onExternalAbort, { once: true });
  }

  const firstResponseTimer = setTimeout(() => abortFor('first'), OPENAI_STREAM_FIRST_RESPONSE_MS);
  const totalTimer = setTimeout(() => abortFor('total'), OPENAI_STREAM_TOTAL_MS);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: formattedMessages,
        temperature: runtime?.temperature ?? 0.7,
        ...(runtime?.maxTokens ? { max_tokens: runtime.maxTokens } : {}),
        stream: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Provider API error (${res.status}): ${errorText.slice(0, 200)}`);
    }

    if (!res.body) {
      throw new Error('Response body is null');
    }

    reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      if (externalSignal?.aborted) {
        abortFor('client');
        throw new Error('CLIENT_ABORTED');
      }

      let idleTimer: ReturnType<typeof setTimeout> | null = null;
      try {
        if (firstResponseSeen) {
          idleTimer = setTimeout(() => abortFor('idle'), OPENAI_STREAM_IDLE_MS);
        }

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
              if (!firstResponseSeen) {
                firstResponseSeen = true;
                clearTimeout(firstResponseTimer);
              }
              yield delta;
            }
          } catch {
            // Skip incomplete or provider-specific non-JSON chunks.
          }
        }
      } finally {
        if (idleTimer) clearTimeout(idleTimer);
      }
    }
  } catch (error) {
    if (abortReason === 'client' || externalSignal?.aborted) {
      throw new Error('CLIENT_ABORTED');
    }
    if (abortReason === 'first') {
      throw new Error(`Provider first response timeout after ${OPENAI_STREAM_FIRST_RESPONSE_MS}ms`);
    }
    if (abortReason === 'idle') {
      throw new Error(`Provider stream idle timeout after ${OPENAI_STREAM_IDLE_MS}ms`);
    }
    if (abortReason === 'total') {
      throw new Error(`Provider stream total timeout after ${OPENAI_STREAM_TOTAL_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(firstResponseTimer);
    clearTimeout(totalTimer);
    externalSignal?.removeEventListener('abort', onExternalAbort);
    if (reader) {
      try {
        await Promise.race([
          reader.cancel(),
          new Promise<void>((resolve) => setTimeout(resolve, 1_000)),
        ]);
      } catch {
        // Best-effort upstream cancellation only.
      }
    }
  }
}
