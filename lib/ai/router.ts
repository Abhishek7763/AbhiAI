import type { AIConnection } from '@/lib/connections';
import { listRuntimeConnections } from '@/lib/data/ai-config';

export interface RouteCandidate {
  connectionId: string;
  name: string;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  modelId: string;
  systemPrompt: string;
  isPrimary?: boolean;
}

export interface SmartRoutePlan {
  primary: RouteCandidate | null;
  fallbacks: RouteCandidate[];
}

function toCandidate(connection: AIConnection, isPrimary = false): RouteCandidate {
  return {
    connectionId: connection.id,
    name: connection.name,
    providerId: connection.providerId || guessProviderId(connection.baseUrl, connection.modelId),
    baseUrl: connection.baseUrl,
    apiKey: connection.apiKey,
    modelId: connection.modelId,
    systemPrompt: connection.systemPrompt || '',
    isPrimary,
  };
}

/**
 * Resolves the primary connection and ordered fallback models from the
 * current Supabase provider/model configuration. Runtime secrets are
 * decrypted server-side and never returned to the browser.
 */
export async function resolveRoutePlan(
  requestedModelOrAlias: string,
  requiresVision: boolean = false,
): Promise<SmartRoutePlan> {
  const runtimeConnections = await listRuntimeConnections();
  const allConnections = runtimeConnections.filter((connection) => connection.isActive && connection.apiKey);

  if (allConnections.length === 0) {
    return { primary: null, fallbacks: [] };
  }

  let primaryConn = allConnections.find(
    (connection) =>
      connection.id === requestedModelOrAlias ||
      connection.assignedAlias === requestedModelOrAlias ||
      connection.name === requestedModelOrAlias ||
      connection.modelId === requestedModelOrAlias,
  );

  // For the generic/default chat path, prefer the newest verified Gemini Flash model.
  if (!primaryConn && (requestedModelOrAlias === 'default' || !requestedModelOrAlias)) {
    primaryConn =
      allConnections.find((connection) => connection.modelId === 'gemini-3.7-flash') ||
      allConnections.find((connection) => connection.modelId === 'gemini-3.6-flash') ||
      allConnections.find((connection) => connection.modelId === 'gemini-3.5-flash-lite') ||
      allConnections[0];
  }

  if (!primaryConn) {
    primaryConn = allConnections[0];
  }

  // Vision capability filtering is intentionally conservative for now: imported
  // Gemini Flash models remain eligible while model capability persistence is
  // completed in the next phase.
  const compatibleConnections = requiresVision
    ? allConnections.filter((connection) => connection.providerId === 'google')
    : allConnections;

  const fallbacks = compatibleConnections
    .filter((connection) => connection.id !== primaryConn?.id)
    .slice(0, 3)
    .map((connection) => toCandidate(connection));

  return {
    primary: toCandidate(primaryConn, true),
    fallbacks,
  };
}

function guessProviderId(baseUrl: string, modelId: string): string {
  const lowerUrl = (baseUrl || '').toLowerCase();
  const lowerModel = (modelId || '').toLowerCase();
  if (lowerUrl.includes('nvidia.com')) return 'nvidia';
  if (lowerUrl.includes('openrouter.ai')) return 'openrouter';
  if (lowerUrl.includes('groq.com')) return 'groq';
  if (lowerUrl.includes('together.xyz')) return 'together';
  if (lowerUrl.includes('google') || lowerModel.includes('gemini')) return 'google';
  return 'openai-compatible';
}
