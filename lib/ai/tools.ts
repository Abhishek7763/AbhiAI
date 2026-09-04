export type AgentToolName = 'web_search' | 'document_qa' | 'image_generation';

export interface AgentToolAttachment {
  name: string;
  type: string;
  data: string;
}

export interface AgentToolRuntime {
  temperature?: number;
  maxTokens?: number;
}

export interface AgentToolImageSettings {
  freeOnlyMode: boolean;
  maxPromptLength: number;
  customImageApiEndpoint?: string;
}

export interface AgentToolResult {
  ok: boolean;
  output?: unknown;
  error?: string;
}

export interface AgentToolContext {
  attachments?: AgentToolAttachment[];
  userId?: string | null;
  imageSettings?: AgentToolImageSettings;
  runtime?: AgentToolRuntime;
  executeTool?: (
    name: string,
    args?: Record<string, unknown>,
  ) => Promise<AgentToolResult>;
}

export interface AgentToolDefinition {
  name: AgentToolName;
  description: string;
  parameters: Record<string, unknown>;
}

export const AGENT_TOOL_DEFINITIONS: AgentToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Search the live web for current or time-sensitive factual information. Use this when the answer may have changed or the user explicitly asks for current information.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'A concise search query containing the key entities and facts needed.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'document_qa',
    description: 'Search the user-attached documents for passages relevant to a specific question. Use this instead of guessing when the answer should come from an attachment.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The question or topic to find in the attached documents.',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'image_generation',
    description: 'Generate an image when the user explicitly asks to create, draw, design, render, or visualize an image. Return the generated image URL in Markdown so it is visible in chat.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'A concise but descriptive image generation prompt based on the user request.',
        },
        style: {
          type: 'string',
          enum: ['photorealistic', 'cinematic', 'digital_art', 'anime', '3d_render', 'minimalist', 'fantasy', 'oil_painting'],
          description: 'Optional visual style. Choose the closest fit to the request.',
        },
        aspect_ratio: {
          type: 'string',
          enum: ['1:1', '16:9', '9:16', '4:3', '3:4'],
          description: 'Optional output aspect ratio.',
        },
      },
      required: ['prompt'],
      additionalProperties: false,
    },
  },
];

export function getAvailableAgentTools(context: AgentToolContext): AgentToolDefinition[] {
  const hasDocuments = (context.attachments ?? []).some(
    (attachment) => !attachment.type.toLowerCase().startsWith('image/'),
  );
  return AGENT_TOOL_DEFINITIONS.filter((tool) => tool.name !== 'document_qa' || hasDocuments);
}
