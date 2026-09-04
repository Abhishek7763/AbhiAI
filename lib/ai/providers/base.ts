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

  /** Tests the connection using the provided API key. */
  testConnection(apiKey: string): Promise<boolean>;

  /** Discovers models available for this provider. */
  discoverModels(apiKey: string): Promise<AIModel[]>;

  /** Sends a normal chat request. */
  chat(apiKey: string, modelId: string, messages: ChatMessage[], systemPrompt?: string): Promise<string>;

  /**
   * Optional provider-native function/tool calling path. The gateway only calls
   * this method with tools that have already passed agent permission filtering.
   * Implementations must keep their tool loop bounded and execute tools through
   * AbhiAI's server-side tool registry rather than trusting model-returned data.
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
