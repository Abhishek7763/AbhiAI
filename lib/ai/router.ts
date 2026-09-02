import { getConnections, AIConnection } from '@/lib/connections';
import { isModelAllowedUnderFreeGuard } from '@/lib/ai/free-guard';
import { getProviderAdapter } from '@/lib/ai/providers/registry';

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

/**
 * Resolves the primary connection and ordered fallback models for any requested alias/ID.
 */
export function resolveRoutePlan(requestedModelOrAlias: string, requiresVision: boolean = false): SmartRoutePlan {
  const connections = getConnections();
  const allConnections = Object.values(connections).filter(c => c.isActive);

  if (allConnections.length === 0) {
    return { primary: null, fallbacks: [] };
  }

  // 1. Try to find the exact or alias-matched connection as Primary
  let primaryConn: AIConnection | undefined = connections[requestedModelOrAlias];
  if (!primaryConn) {
    primaryConn = allConnections.find(
      c => c.assignedAlias === requestedModelOrAlias || c.name === requestedModelOrAlias || c.modelId === requestedModelOrAlias
    );
  }

  // If still not found, fallback to first available active connection
  if (!primaryConn) {
    primaryConn = allConnections[0];
  }

  // 2. Build list of compatible fallbacks
  const fallbacks: RouteCandidate[] = allConnections
    .filter(c => c.id !== primaryConn?.id)
    .map(c => ({
      connectionId: c.id,
      name: c.name,
      providerId: guessProviderId(c.baseUrl, c.modelId),
      baseUrl: c.baseUrl,
      apiKey: c.apiKey,
      modelId: c.modelId,
      systemPrompt: c.systemPrompt || '',
    }));

  const primaryCandidate: RouteCandidate = {
    connectionId: primaryConn.id,
    name: primaryConn.name,
    providerId: guessProviderId(primaryConn.baseUrl, primaryConn.modelId),
    baseUrl: primaryConn.baseUrl,
    apiKey: primaryConn.apiKey,
    modelId: primaryConn.modelId,
    systemPrompt: primaryConn.systemPrompt || '',
    isPrimary: true,
  };

  return {
    primary: primaryCandidate,
    fallbacks: fallbacks.slice(0, 3), // Max 3 fallback hops to avoid loops
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
