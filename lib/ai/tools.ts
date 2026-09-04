import type { AppSettings } from '@/lib/app-settings';
import { generateImageWithConfiguredProviders, ImageGenerationInputError } from '@/lib/ai/image-generation-service';
import { fetchWebGroundingContext } from '@/lib/ai/web-search';
import { getStoredSettings } from '@/lib/data/admin-config';
import { extractDocumentText, isImageAttachment, type AttachmentPayload } from '@/lib/files/document-extractor';

export type AgentToolName = 'web_search' | 'document_qa' | 'image_generation';

export interface AgentToolDefinition {
  name: AgentToolName;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentToolContext {
  attachments?: AttachmentPayload[];
  userId?: string | null;
  imageSettings?: Pick<AppSettings, 'freeOnlyMode' | 'maxPromptLength' | 'customImageApiEndpoint'>;
}

export interface AgentToolResult {
  ok: boolean;
  output?: unknown;
  error?: string;
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

function normalizeQueryWords(query: string) {
  return new Set(
    query
      .toLowerCase()
      .replace(/[^a-z0-9\u0900-\u097f\s]/gi, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 3),
  );
}

function scoreChunk(chunk: string, queryWords: Set<string>) {
  const lower = chunk.toLowerCase();
  let score = 0;
  for (const word of queryWords) {
    if (lower.includes(word)) score += 1;
  }
  return score;
}

function buildDocumentAnswerContext(query: string, attachments: AttachmentPayload[]) {
  const queryWords = normalizeQueryWords(query);
  const candidates: Array<{ name: string; chunk: string; score: number }> = [];

  for (const attachment of attachments) {
    if (isImageAttachment(attachment)) continue;
    const extracted = extractDocumentText(attachment);
    const chunks = extracted.text
      .split(/\n{2,}|(?<=[.!?])\s+(?=[A-Z0-9\u0900-\u097f])/)
      .map((chunk) => chunk.trim())
      .filter((chunk) => chunk.length >= 40);

    for (const chunk of chunks) {
      candidates.push({
        name: extracted.name,
        chunk: chunk.slice(0, 2200),
        score: scoreChunk(chunk, queryWords),
      });
    }
  }

  const ranked = candidates
    .sort((a, b) => b.score - a.score || b.chunk.length - a.chunk.length)
    .slice(0, 8);

  return ranked.map((item, index) => ({
    rank: index + 1,
    document: item.name,
    relevanceScore: item.score,
    passage: item.chunk,
  }));
}

export function getAvailableAgentTools(context: AgentToolContext): AgentToolDefinition[] {
  const hasDocuments = (context.attachments ?? []).some((attachment) => !isImageAttachment(attachment));
  return AGENT_TOOL_DEFINITIONS.filter((tool) => tool.name !== 'document_qa' || hasDocuments);
}

export async function executeAgentTool(
  name: string,
  args: Record<string, unknown> | undefined,
  context: AgentToolContext,
): Promise<AgentToolResult> {
  if (name === 'image_generation') {
    const prompt = typeof args?.prompt === 'string' ? args.prompt.trim() : '';
    const style = typeof args?.style === 'string' ? args.style : 'photorealistic';
    const aspectRatio = typeof args?.aspect_ratio === 'string' ? args.aspect_ratio : '1:1';

    try {
      const settings = context.imageSettings ?? await getStoredSettings();
      const result = await generateImageWithConfiguredProviders({
        prompt,
        style,
        aspectRatio,
        engine: 'auto',
        userId: context.userId ?? null,
        settings,
      });

      return {
        ok: true,
        output: {
          ...result,
          markdown: `![Generated image](${result.imageUrl})`,
          instruction: 'Include the provided Markdown image exactly once in the final answer. Do not invent a different image URL.',
        },
      };
    } catch (error) {
      if (error instanceof ImageGenerationInputError) {
        return { ok: false, error: error.message };
      }
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Image generation failed.',
      };
    }
  }

  const query = typeof args?.query === 'string' ? args.query.trim().slice(0, 500) : '';
  if (!query) return { ok: false, error: 'A non-empty query is required.' };

  if (name === 'web_search') {
    const result = await fetchWebGroundingContext(query);
    if (!result.contextText) {
      return { ok: false, error: 'No useful live web results were found for this query.' };
    }
    return {
      ok: true,
      output: {
        query,
        context: result.contextText,
        sources: result.sources,
      },
    };
  }

  if (name === 'document_qa') {
    const attachments = context.attachments ?? [];
    const passages = buildDocumentAnswerContext(query, attachments);
    if (passages.length === 0) {
      return { ok: false, error: 'No searchable text passages were available in the attached documents.' };
    }
    return {
      ok: true,
      output: {
        query,
        passages,
        instruction: 'Answer from these passages only when the user asked about the attached documents. If the passages do not support the answer, say so.',
      },
    };
  }

  return { ok: false, error: `Unknown tool: ${name}` };
}
