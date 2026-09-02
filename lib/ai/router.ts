import type { AIConnection } from '@/lib/connections';
import { listRuntimeConnections } from '@/lib/data/ai-config';
import { getAbhiAIModeInstruction } from '@/lib/ai/modes';
import { listCoolingRuntimeModelIds } from '@/lib/ai/runtime-health';

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
  const modeInstruction = getAbhiAIModeInstruction({
    name: connection.name,
    modelId: connection.modelId,
  });

  return {
    connectionId: connection.id,
    name: connection.name,
    providerId: connection.providerId || guessProviderId(connection.baseUrl, connection.modelId),
    baseUrl: connection.baseUrl,
    apiKey: connection.apiKey,
    modelId: connection.modelId,
    systemPrompt: [modeInstruction, connection.systemPrompt || ''].filter(Boolean).join('\n\n'),
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
  requiresMultimodal: boolean = false,
): Promise<SmartRoutePlan> {
  const [runtimeConnections, coolingModelIds] = await Promise.all([
    listRuntimeConnections(),
    listCoolingRuntimeModelIds(),
  ]);

  const allConnections = runtimeConnections.filter(
    (connection) => connection.isActive && connection.apiKey && !coolingModelIds.has(connection.id),
  );

  const compatibleConnections = requiresMultimodal
    ? allConnections.filter((connection) => connection.providerId === 'google')
    : allConnections;

  if (compatibleConnections.length === 0) {
    return { primary: null, fallbacks: [] };
  }

  let primaryConn = compatibleConnections.find(
    (connection) =>
      connection.id === requestedModelOrAlias ||
      connection.assignedAlias === requestedModelOrAlias ||
      connection.name === requestedModelOrAlias ||
      connection.modelId === requestedModelOrAlias,
  );

  if (!primaryConn && (requestedModelOrAlias === 'default' || !requestedModelOrAlias)) {
    primaryConn =
      compatibleConnections.find((connection) => connection.modelId === 'gemini-3.7-flash') ||
      compatibleConnections.find((connection) => connection.modelId === 'gemini-3.6-flash') ||
      compatibleConnections.find((connection) => connection.modelId === 'gemini-3.5-flash-lite') ||
      compatibleConnections[0];
  }

  if (!primaryConn) {
    primaryConn = compatibleConnections[0];
  }

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
