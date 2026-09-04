import { GoogleGenAI, type Content, type Model, type Part } from '@google/genai';
import type { AgentToolContext, AgentToolDefinition } from '@/lib/ai/tools';
import { executeAgentTool } from '@/lib/ai/tools';
import type { AIModel, ChatMessage, ProviderAdapter } from './base';

const MAX_TOOL_ROUNDS = 3;

function normalizeModelId(name?: string): string {
  return (name || '').replace(/^models\//, '');
}

function supportsTextGeneration(model: Model): boolean {
  const id = normalizeModelId(model.name).toLowerCase();
  if (!id.startsWith('gemini-')) return false;

  const excludedKinds = ['embedding', 'image', 'live', 'tts', 'transcribe', 'robotics', 'computer-use'];
  if (excludedKinds.some((kind) => id.includes(kind))) return false;

  const actions = model.supportedActions ?? [];
  return actions.length === 0 || actions.some((action) => action.toLowerCase().includes('generatecontent'));
}

function inferCapabilities(model: Model): string[] {
  const id = normalizeModelId(model.name).toLowerCase();
  const capabilities = new Set<string>(['text']);

  if (id.includes('flash')) capabilities.add('fast');
  if (id.includes('pro') || model.thinking) capabilities.add('reasoning');

  const description = `${model.displayName || ''} ${model.description || ''}`.toLowerCase();
  if (description.includes('multimodal') || description.includes('image') || description.includes('vision')) {
    capabilities.add('vision');
  }

  return Array.from(capabilities);
}

function safeGoogleError(error: unknown, fallback: string): Error {
  const message = error instanceof Error ? error.message : String(error || '');
  const normalized = message.toLowerCase();

  if (normalized.includes('api key') || normalized.includes('unauth') || normalized.includes('permission')) {
    return new Error('Google Gemini authentication failed. Verify the API key and try again.');
  }
  if (normalized.includes('429') || normalized.includes('quota') || normalized.includes('rate limit')) {
    return new Error('Google Gemini rate limit or quota was reached. Try again later or verify the project quota.');
  }
  if (normalized.includes('not found') || normalized.includes('404')) {
    return new Error('The selected Gemini model is not available for this API key. Refresh the model list and choose an available model.');
  }

  return new Error(fallback);
}

function messageParts(message: ChatMessage): Part[] {
  const parts: Part[] = [];
  if (message.content) parts.push({ text: message.content });

  for (const attachment of message.attachments ?? []) {
    parts.push({
      inlineData: {
        data: attachment.data,
        mimeType: attachment.type,
      },
    });
  }

  if (parts.length === 0) parts.push({ text: ' ' });
  return parts;
}

function toGoogleContent(message: ChatMessage): Content {
  return {
    role: message.role === 'user' ? 'user' : 'model',
    parts: messageParts(message),
  };
}

export class GoogleProvider implements ProviderAdapter {
  id = 'google';
  name = 'Google Gemini';

  async testConnection(apiKey: string): Promise<boolean> {
    if (!apiKey.trim()) {
      throw new Error('Google Gemini API key is required.');
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const pager = await ai.models.list();

      for await (const model of pager) {
        if (supportsTextGeneration(model)) return true;
      }

      throw new Error('No text-generation Gemini models are available for this API key.');
    } catch (error) {
      throw safeGoogleError(error, 'Could not connect to Google Gemini. Verify the API key and network access.');
    }
  }

  async discoverModels(apiKey: string): Promise<AIModel[]> {
    if (!apiKey.trim()) {
      throw new Error('Google Gemini API key is required.');
    }

    try {
      const ai = new GoogleGenAI({ apiKey });
      const pager = await ai.models.list();
      const discovered: AIModel[] = [];

      for await (const model of pager) {
        if (!supportsTextGeneration(model)) continue;
        const id = normalizeModelId(model.name);
        if (!id) continue;

        discovered.push({
          id,
          name: model.displayName?.trim() || id,
          provider: this.id,
          capabilities: inferCapabilities(model),
        });
      }

      return discovered.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));
    } catch (error) {
      throw safeGoogleError(error, 'Could not discover Gemini models. Verify the API key and try again.');
    }
  }

  async chat(apiKey: string, modelId: string, messages: ChatMessage[], systemPrompt?: string): Promise<string> {
    const ai = new GoogleGenAI({ apiKey });
    const contents = messages.map(toGoogleContent);

    try {
      const response = await ai.models.generateContent({
        model: modelId,
        contents,
        config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
      });

      return response.text ?? 'No response generated.';
    } catch (error) {
      throw safeGoogleError(error, 'Google Gemini failed to generate a response.');
    }
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

    const ai = new GoogleGenAI({ apiKey });
    const history = messages.slice(0, -1).map(toGoogleContent);
    const currentMessage = messages.at(-1) ?? { role: 'user' as const, content: ' ' };

    try {
      const chat = ai.chats.create({
        model: modelId,
        history,
        config: {
          ...(systemPrompt ? { systemInstruction: systemPrompt } : {}),
          tools: [{
            functionDeclarations: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              parametersJsonSchema: tool.parameters,
            })),
          }],
        },
      });

      let response = await chat.sendMessage({ message: messageParts(currentMessage) });

      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        const functionCalls = response.functionCalls ?? [];
        if (functionCalls.length === 0) {
          return response.text ?? 'No response generated.';
        }

        const toolResponses: Part[] = [];
        for (const call of functionCalls) {
          const name = call.name || '';
          const result = await executeAgentTool(name, call.args, context);
          toolResponses.push({
            functionResponse: {
              ...(call.id ? { id: call.id } : {}),
              name,
              response: result.ok
                ? { output: result.output ?? null }
                : { error: result.error || 'Tool execution failed.' },
            },
          });
        }

        response = await chat.sendMessage({ message: toolResponses });
      }

      return response.text ?? 'I could not complete the tool workflow within the allowed number of steps.';
    } catch (error) {
      throw safeGoogleError(error, 'Google Gemini failed while executing agent tools.');
    }
  }
}
