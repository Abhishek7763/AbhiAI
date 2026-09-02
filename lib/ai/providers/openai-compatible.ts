import { AIModel, ChatMessage, ProviderAdapter } from './base';

export interface OpenAICompatibleConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  modelsEndpoint?: string;
  chatEndpoint?: string;
  customHeaders?: Record<string, string>;
  knownModels?: AIModel[];
}

export class OpenAICompatibleProvider implements ProviderAdapter {
  id: string;
  name: string;
  baseUrl: string;
  modelsEndpoint: string;
  chatEndpoint: string;
  customHeaders: Record<string, string>;
  knownModels?: AIModel[];

  constructor(config: OpenAICompatibleConfig) {
    this.id = config.id;
    this.name = config.name;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.modelsEndpoint = config.modelsEndpoint || `${this.baseUrl}/models`;
    this.chatEndpoint = config.chatEndpoint || `${this.baseUrl}/chat/completions`;
    this.customHeaders = config.customHeaders || {};
    this.knownModels = config.knownModels;
  }

  private getHeaders(apiKey: string): HeadersInit {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...this.customHeaders,
    };

    // Specific header requirements for popular providers
    if (this.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://abhiai.app';
      headers['X-Title'] = 'AbhiAI';
    }

    return headers;
  }

  async testConnection(apiKey: string): Promise<boolean> {
    try {
      // 1. Try listing models first if endpoint exists
      const modelsRes = await fetch(this.modelsEndpoint, {
        method: 'GET',
        headers: this.getHeaders(apiKey),
        signal: AbortSignal.timeout(10000),
      });

      if (modelsRes.ok) {
        return true;
      }

      // 2. If models endpoint returns 404 or fails, test a tiny chat completion ping
      const pingModel = this.knownModels?.[0]?.id || 'gpt-3.5-turbo';
      const chatRes = await fetch(this.chatEndpoint, {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify({
          model: pingModel,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1,
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (chatRes.ok) {
        return true;
      }

      const errText = await chatRes.text();
      throw new Error(`Test failed (${chatRes.status}): ${errText.slice(0, 200)}`);
    } catch (error: any) {
      console.error(`[${this.name}] Connection test error:`, error);
      throw new Error(error.message || 'Connection test failed');
    }
  }

  async discoverModels(apiKey: string): Promise<AIModel[]> {
    try {
      const res = await fetch(this.modelsEndpoint, {
        method: 'GET',
        headers: this.getHeaders(apiKey),
        signal: AbortSignal.timeout(12000),
      });

      if (!res.ok) {
        console.warn(`[${this.name}] Models discovery returned ${res.status}, falling back to preset catalogue`);
        return this.knownModels || [];
      }

      const data = await res.json();
      const rawList = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];

      if (!rawList.length && this.knownModels) {
        return this.knownModels;
      }

      return rawList.map((m: any) => {
        const modelId = m.id || m.name;
        const capabilities: string[] = ['text'];

        // Capability heuristics
        const lower = modelId.toLowerCase();
        if (lower.includes('vision') || lower.includes('vl') || lower.includes('4o') || lower.includes('claude-3') || lower.includes('gemini') || lower.includes('pixtral')) {
          capabilities.push('vision');
        }
        if (lower.includes('deepseek-r1') || lower.includes('reasoning') || lower.includes('o1') || lower.includes('o3') || lower.includes('qwq')) {
          capabilities.push('reasoning');
        }
        if (lower.includes('coder') || lower.includes('code') || lower.includes('starcoder') || lower.includes('qwen-2.5-coder')) {
          capabilities.push('coding');
        }

        return {
          id: modelId,
          name: m.name || modelId.split('/').pop() || modelId,
          provider: this.id,
          capabilities,
        };
      });
    } catch (error) {
      console.warn(`[${this.name}] Failed to discover models dynamically:`, error);
      return this.knownModels || [];
    }
  }

  async chat(apiKey: string, modelId: string, messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    const formattedMessages: any[] = [];

    if (systemPrompt) {
      formattedMessages.push({ role: 'system', content: systemPrompt });
    }

    for (const msg of messages) {
      if (msg.attachments && msg.attachments.length > 0) {
        // Vision format for OpenAI compatible providers
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

    const res = await fetch(this.chatEndpoint, {
      method: 'POST',
      headers: this.getHeaders(apiKey),
      body: JSON.stringify({
        model: modelId,
        messages: formattedMessages,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Provider API error (${res.status}): ${errorText.slice(0, 300)}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || 'No response generated.';
  }
}
