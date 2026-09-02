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
   * Send a chat request
   */
  chat(apiKey: string, modelId: string, messages: ChatMessage[], systemPrompt?: string): Promise<string>;
}
