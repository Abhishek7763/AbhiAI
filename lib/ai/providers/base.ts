import type { AgentToolContext, AgentToolDefinition } from '@/lib/ai/tools';

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: {
    name: string;
    type: string;
    data: string; // base64 string
  }[];
}

export interface ProviderAdapter {
  id: string;
  name: string;

  /**
   * Tests the connection using the provided API key
   * Returns true if successful, throws error if failed
   */
  testConnection(apiKey: string): Promise<boolean>;

  /**
   * Discovers models available for this provider
   */
  discoverModels(apiKey: string): Promise<AIModel[]>;

  /**
   * Send a plain chat request.
   */
  chat(apiKey: string, modelId: string, messages: ChatMessage[], systemPrompt?: string): Promise<string>;

  /**
   * Optional native function/tool-calling path. Providers that implement this
   * allow the model to choose tools during the response instead of AbhiAI
   * pre-running every tool heuristically.
   */
  chatWithTools?(
    apiKey: string,
    modelId: string,
    messages: ChatMessage[],
    systemPrompt: string | undefined,
    tools: AgentToolDefinition[],
    context: AgentToolContext,
  ): Promise<string>;
}
