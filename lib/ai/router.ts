import type { AIConnection } from '@/lib/connections';
import { listRuntimeConnections } from '@/lib/data/ai-config';
import { getRoutingConfig, type RoutingConfig } from '@/lib/data/routing-config';
import { resolvePublicAlias } from '@/lib/data/public-aliases';
import { getAbhiAIModeInstruction } from '@/lib/ai/modes';
import { listRuntimeRoutingSignals, type RuntimeRoutingSignal } from '@/lib/ai/runtime-health';
import { withTimeout } from '@/lib/ai/timeout';

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

type RequestIntent = {
  coding: boolean;
  reasoning: boolean;
  multimodal: boolean;
  speedFriendly: boolean;
};

type ScoredConnection = {
  connection: AIConnection;
  score: number;
};

const MAX_CANDIDATES_PER_REQUEST = 4;
const ROUTING_CONFIG_TIMEOUT_MS = 7_000;

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

function parseTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isCooling(signal: RuntimeRoutingSignal | undefined, now = Date.now()) {
  const cooldownUntil = parseTimestamp(signal?.cooldownUntil);
  return cooldownUntil !== null && cooldownUntil > now;
}

function detectIntent(requestText: string, requiresMultimodal: boolean): RequestIntent {
  const text = requestText.toLowerCase();
  const coding = /\b(code|coding|coder|program|programming|html|css|javascript|typescript|python|java|kotlin|swift|sql|api|react|next\.?js|node\.?js|debug|bug|function|script|website|webapp|web app)\b/i.test(text)
    || /code do|code likh|app bana|website bana|error fix|bug fix/i.test(text);
  const reasoning = /\b(reason|reasoning|analy[sz]e|analysis|compare|solve|proof|math|calculate|architecture|strategy|plan|explain|why|logic|deep)\b/i.test(text)
    || /kyu|kaise|samjha|detail|tulna|hal karo|solve karo/i.test(text);

  return {
    coding,
    reasoning,
    multimodal: requiresMultimodal,
    speedFriendly: !coding && !reasoning && !requiresMultimodal && text.trim().length < 220,
  };
}

function capabilityBonus(
  connection: AIConnection,
  signal: RuntimeRoutingSignal | undefined,
  intent: RequestIntent,
) {
  const capabilities = new Set((signal?.capabilities ?? []).map((item) => item.toLowerCase()));
  const identity = `${connection.name} ${connection.modelId}`.toLowerCase();
  let score = 0;

  if (intent.coding) {
    if (capabilities.has('coding') || capabilities.has('code') || /coder|coding|code|qwen.*coder/.test(identity)) score += 40;
    else if (capabilities.has('reasoning')) score += 8;
  }

  if (intent.reasoning) {
    if (capabilities.has('reasoning') || capabilities.has('thinking')) score += 30;
    if (/reason|thinking|deepseek.*r1|\br1\b/.test(identity)) score += 18;
  }

  if (intent.multimodal) {
    if (
      capabilities.has('vision') ||
      capabilities.has('image') ||
      capabilities.has('document') ||
      capabilities.has('pdf')
    ) score += 35;
    if (connection.providerId === 'google') score += 8;
  }

  if (intent.speedFriendly) {
    if (capabilities.has('fast')) score += 12;
    if (/flash|lite|mini|small|8b/.test(identity)) score += 8;
  }

  return score;
}

function healthScore(signal: RuntimeRoutingSignal | undefined) {
  if (!signal) return 0;
  let score = 0;
  const now = Date.now();
  const lastSuccess = parseTimestamp(signal.lastSuccessAt);
  const lastFailure = parseTimestamp(signal.lastFailureAt);

  if (lastSuccess !== null) {
    const successAge = now - lastSuccess;
    if (successAge < 15 * 60_000) score += 18;
    else if (successAge < 2 * 60 * 60_000) score += 10;
    else if (successAge < 24 * 60 * 60_000) score += 4;
  }

  if (lastFailure !== null && (lastSuccess === null || lastFailure > lastSuccess)) {
    score -= 22;
  }

  score -= Math.min(32, signal.consecutiveFailures * 8);

  const latency = signal.avgLatencyMs ?? signal.lastLatencyMs;
  if (latency !== null) {
    if (latency <= 1_000) score += 24;
    else if (latency <= 2_500) score += 18;
    else if (latency <= 5_000) score += 12;
    else if (latency <= 10_000) score += 5;
    else if (latency > 20_000) score -= 10;
  }

  return score;
}

function scoreConnection(
  connection: AIConnection,
  signal: RuntimeRoutingSignal | undefined,
  routingConfig: RoutingConfig,
  intent: RequestIntent,
) {
  let score = 100;
  const poolIndex = routingConfig.poolModelRecordIds.indexOf(connection.id);
  const hasConfiguredPool = routingConfig.poolModelRecordIds.length > 0;

  if (poolIndex >= 0) {
    score += 45;
    score += Math.max(0, 20 - poolIndex);
  } else if (hasConfiguredPool) {
    score -= 35;
  }

  if (routingConfig.preferredModelRecordId === connection.id) score += 20;

  const priority = signal?.priority ?? 100;
  score += Math.max(-10, 18 - Math.min(priority, 28));
  score += healthScore(signal);
  score += capabilityBonus(connection, signal, intent);

  return score;
}

function rankConnections(
  connections: AIConnection[],
  signalById: Map<string, RuntimeRoutingSignal>,
  routingConfig: RoutingConfig,
  intent: RequestIntent,
): ScoredConnection[] {
  return connections
    .map((connection) => ({
      connection,
      score: scoreConnection(connection, signalById.get(connection.id), routingConfig, intent),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const aPriority = signalById.get(a.connection.id)?.priority ?? 100;
      const bPriority = signalById.get(b.connection.id)?.priority ?? 100;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.connection.name.localeCompare(b.connection.name);
    });
}

function selectDiverseCandidates(scored: ScoredConnection[]) {
  if (scored.length <= 1) return scored.slice(0, MAX_CANDIDATES_PER_REQUEST);

  const primary = scored[0];
  const rest = scored.slice(1);
  const differentProvider = rest.find(
    (item) => (item.connection.providerId || guessProviderId(item.connection.baseUrl, item.connection.modelId))
      !== (primary.connection.providerId || guessProviderId(primary.connection.baseUrl, primary.connection.modelId)),
  );

  const ordered = [primary];
  if (differentProvider) ordered.push(differentProvider);
  for (const item of rest) {
    if (differentProvider && item.connection.id === differentProvider.connection.id) continue;
    ordered.push(item);
  }

  return ordered.slice(0, MAX_CANDIDATES_PER_REQUEST);
}

/**
 * Resolves the primary connection and a bounded set of smart fallbacks.
 * AbhiAI Auto ranks the full admin pool by health, recent success, latency,
 * capabilities and priority, while Free Guard/cooldown filtering stays enforced.
 * Public Phase 9 aliases are resolved server-side so provider/model identities
 * never need to be exposed in the public selector.
 */
export async function resolveRoutePlan(
  requestedModelOrAlias: string,
  requiresMultimodal: boolean = false,
  requestText: string = '',
): Promise<SmartRoutePlan> {
  const publicAliasTarget = requestedModelOrAlias?.startsWith('abhiai-')
    ? await resolvePublicAlias(requestedModelOrAlias)
    : null;
  const resolvedRequest = publicAliasTarget || requestedModelOrAlias;

  if (requestedModelOrAlias?.startsWith('abhiai-') && !publicAliasTarget) {
    return { primary: null, fallbacks: [] };
  }

  const [runtimeConnections, routingConfig, routingSignals] = await withTimeout(
    Promise.all([
      listRuntimeConnections(),
      getRoutingConfig(),
      listRuntimeRoutingSignals(),
    ]),
    ROUTING_CONFIG_TIMEOUT_MS,
    'AbhiAI routing configuration',
  );

  const signalById = new Map(routingSignals.map((signal) => [signal.id, signal]));
  const now = Date.now();
  const healthyRuntime = runtimeConnections.filter(
    (connection) => connection.isActive && connection.apiKey && !isCooling(signalById.get(connection.id), now),
  );

  const compatibleConnections = requiresMultimodal
    ? healthyRuntime.filter((connection) => connection.providerId === 'google')
    : healthyRuntime;

  if (compatibleConnections.length === 0) {
    return { primary: null, fallbacks: [] };
  }

  const intent = detectIntent(requestText, requiresMultimodal);
  const isAutoRequest = !resolvedRequest || resolvedRequest === 'default' || resolvedRequest === 'auto';

  if (isAutoRequest) {
    const poolSet = new Set(routingConfig.poolModelRecordIds);
    const strictPoolActive = routingConfig.strictPool && poolSet.size > 0;
    const autoCandidates = strictPoolActive
      ? compatibleConnections.filter((connection) => poolSet.has(connection.id))
      : compatibleConnections;

    if (autoCandidates.length === 0) {
      return { primary: null, fallbacks: [] };
    }

    const selected = selectDiverseCandidates(
      rankConnections(autoCandidates, signalById, routingConfig, intent),
    );
    const [primary, ...fallbacks] = selected;

    return {
      primary: primary ? toCandidate(primary.connection, true) : null,
      fallbacks: fallbacks.map((item) => toCandidate(item.connection)),
    };
  }

  const requested = compatibleConnections.find(
    (connection) =>
      connection.id === resolvedRequest ||
      connection.assignedAlias === resolvedRequest ||
      connection.name === resolvedRequest ||
      connection.modelId === resolvedRequest,
  );

  const rankedFallbacks = selectDiverseCandidates(
    rankConnections(
      compatibleConnections.filter((connection) => connection.id !== requested?.id),
      signalById,
      routingConfig,
      intent,
    ),
  );

  if (requested) {
    return {
      primary: toCandidate(requested, true),
      fallbacks: rankedFallbacks.slice(0, MAX_CANDIDATES_PER_REQUEST - 1).map((item) => toCandidate(item.connection)),
    };
  }

  const [best, ...fallbacks] = rankedFallbacks;
  return {
    primary: best ? toCandidate(best.connection, true) : null,
    fallbacks: fallbacks.slice(0, MAX_CANDIDATES_PER_REQUEST - 1).map((item) => toCandidate(item.connection)),
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
