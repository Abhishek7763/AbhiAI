import type { AIConnection } from '@/lib/connections';
import { listRuntimeConnections } from '@/lib/data/ai-config';
import { getRoutingConfig } from '@/lib/data/routing-config';
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

function orderedAutoPool(
  connections: AIConnection[],
  preferredModelRecordId: string | null,
  poolModelRecordIds: string[],
) {
  const byId = new Map(connections.map((connection) => [connection.id, connection]));
  const ordered: AIConnection[] = [];
  const seen = new Set<string>();

  const push = (id: string | null | undefined) => {
    if (!id || seen.has(id)) return;
    const connection = byId.get(id);
    if (!connection) return;
    seen.add(id);
    ordered.push(connection);
  };

  push(preferredModelRecordId);
  for (const id of poolModelRecordIds) push(id);

  // If the admin has not configured a pool yet, preserve a safe working default.
  if (ordered.length === 0) {
    push(connections.find((connection) => connection.modelId === 'gemini-3.7-flash')?.id);
    push(connections.find((connection) => connection.modelId === 'gemini-3.6-flash')?.id);
    push(connections.find((connection) => connection.modelId === 'gemini-3.5-flash-lite')?.id);
  }

  // Keep other runtime-eligible models as last-resort failovers without overriding
  // the admin's preferred/default-pool ordering.
  for (const connection of connections) push(connection.id);
  return ordered;
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
  const [runtimeConnections, coolingModelIds, routingConfig] = await Promise.all([
    listRuntimeConnections(),
    listCoolingRuntimeModelIds(),
    getRoutingConfig(),
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

  const isAutoRequest = !requestedModelOrAlias || requestedModelOrAlias === 'default' || requestedModelOrAlias === 'auto';

  if (isAutoRequest) {
    const ordered = orderedAutoPool(
      compatibleConnections,
      routingConfig.preferredModelRecordId,
      routingConfig.poolModelRecordIds,
    );
    const [primaryConn, ...fallbackConnections] = ordered;
    if (!primaryConn) return { primary: null, fallbacks: [] };

    return {
      primary: toCandidate(primaryConn, true),
      fallbacks: fallbackConnections.map((connection) => toCandidate(connection)),
    };
  }

  let primaryConn = compatibleConnections.find(
    (connection) =>
      connection.id === requestedModelOrAlias ||
      connection.assignedAlias === requestedModelOrAlias ||
      connection.name === requestedModelOrAlias ||
      connection.modelId === requestedModelOrAlias,
  );

  if (!primaryConn) primaryConn = compatibleConnections[0];

  const fallbacks = compatibleConnections
    .filter((connection) => connection.id !== primaryConn?.id)
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
  if (lowerUrl.includes('cerebras.ai')) return 'cerebras';
  if (lowerUrl.includes('sambanova.ai')) return 'sambanova';
  if (lowerUrl.includes('google') || lowerModel.includes('gemini')) return 'google';
  return 'openai-compatible';
}
