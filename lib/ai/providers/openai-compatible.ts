import { AIModel, ChatMessage, ProviderAdapter } from './base';
import { logger } from '@/lib/logger';
import type { AgentToolContext, AgentToolDefinition } from '@/lib/ai/tools';

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

const MAX_TOOL_ROUNDS = 3;

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

    if (this.id === 'openrouter') {
      headers['HTTP-Referer'] = 'https://abhiai.app';
      headers['X-Title'] = 'AbhiAI';
    }

    return headers;
  }

  private formatMessages(messages: ChatMessage[], systemPrompt?: string) {
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

    return formattedMessages;
  }

  async testConnection(apiKey: string): Promise<boolean> {
    try {
      const modelsRes = await fetch(this.modelsEndpoint, {
        method: 'GET',
        headers: this.getHeaders(apiKey),
        signal: AbortSignal.timeout(10000),
      });

      if (modelsRes.ok) return true;

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

      if (chatRes.ok) return true;

      const errText = await chatRes.text();
      throw new Error(`Test failed (${chatRes.status}): ${errText.slice(0, 200)}`);
    } catch (error) {
      logger.warn(`${this.name} connection test failed.`, error);
      throw new Error(error instanceof Error ? error.message : 'Connection test failed');
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
        logger.warn(`${this.name} model discovery returned HTTP ${res.status}; using preset catalogue.`);
        return this.knownModels || [];
      }

      const data = await res.json();
      const rawList = Array.isArray(data.data) ? data.data : Array.isArray(data.models) ? data.models : [];
      if (!rawList.length && this.knownModels) return this.knownModels;

      return rawList.map((m: any) => {
        const modelId = m.id || m.name;
        const capabilities: string[] = ['text'];
        const lower = modelId.toLowerCase();
        if (lower.includes('vision') || lower.includes('vl') || lower.includes('4o') || lower.includes('claude-3') || lower.includes('gemini') || lower.includes('pixtral')) capabilities.push('vision');
        if (lower.includes('deepseek-r1') || lower.includes('reasoning') || lower.includes('o1') || lower.includes('o3') || lower.includes('qwq')) capabilities.push('reasoning');
        if (lower.includes('coder') || lower.includes('code') || lower.includes('starcoder') || lower.includes('qwen-2.5-coder')) capabilities.push('coding');
        return {
          id: modelId,
          name: m.name || modelId.split('/').pop() || modelId,
          provider: this.id,
          capabilities,
        };
      });
    } catch (error) {
      logger.warn(`${this.name} dynamic model discovery failed; using preset catalogue.`, error);
      return this.knownModels || [];
    }
  }

  async chat(apiKey: string, modelId: string, messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    const res = await fetch(this.chatEndpoint, {
      method: 'POST',
      headers: this.getHeaders(apiKey),
      body: JSON.stringify({
        model: modelId,
        messages: this.formatMessages(messages, systemPrompt),
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

  async chatWithTools(
    apiKey: string,
    modelId: string,
    messages: ChatMessage[],
    systemPrompt: string | undefined,
    tools: AgentToolDefinition[],
    context: AgentToolContext,
  ): Promise<string> {
    if (tools.length === 0) return this.chat(apiKey, modelId, messages, systemPrompt);
    if (!context.executeTool) throw new Error('Server tool executor is unavailable.');

    const temperature = context.runtime?.temperature ?? 0.7;
    const tokenLimit = context.runtime?.maxTokens;
    const conversation: any[] = this.formatMessages(messages, systemPrompt);
    const toolPayload = tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));

    for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
      const res = await fetch(this.chatEndpoint, {
        method: 'POST',
        headers: this.getHeaders(apiKey),
        body: JSON.stringify({
          model: modelId,
          messages: conversation,
          tools: toolPayload,
          tool_choice: 'auto',
          temperature,
          ...(tokenLimit ? { max_tokens: tokenLimit } : {}),
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Provider tool-call API error (${res.status}): ${errorText.slice(0, 300)}`);
      }

      const data = await res.json();
      const assistantMessage = data.choices?.[0]?.message;
      if (!assistantMessage) throw new Error('Provider returned no assistant message.');

      const toolCalls = Array.isArray(assistantMessage.tool_calls) ? assistantMessage.tool_calls : [];
      if (toolCalls.length === 0) {
        return assistantMessage.content || 'No response generated.';
      }

      conversation.push(assistantMessage);

      for (const call of toolCalls) {
        const name = call?.function?.name;
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call?.function?.arguments || '{}');
        } catch {
          args = {};
        }

        const result = await context.executeTool(name, args);
        conversation.push({
          role: 'tool',
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
      }
    }

    conversation.push({
      role: 'user',
      content: 'Tool-call limit reached. Give the best final answer using the tool results already available. Do not call another tool.',
    });

    const finalRes = await fetch(this.chatEndpoint, {
      method: 'POST',
      headers: this.getHeaders(apiKey),
      body: JSON.stringify({
        model: modelId,
        messages: conversation,
        temperature,
        ...(tokenLimit ? { max_tokens: tokenLimit } : {}),
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!finalRes.ok) throw new Error(`Provider finalization failed (${finalRes.status}).`);
    const finalData = await finalRes.json();
    return finalData.choices?.[0]?.message?.content || 'No response generated.';
  }
}
