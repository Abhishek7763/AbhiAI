import { NextResponse } from 'next/server';
import type { AIConnection } from '@/lib/connections';
import { listConnections, listRuntimeConnections } from '@/lib/data/ai-config';
import { getProviderAdapter } from '@/lib/ai/providers/registry';
import { diagnoseAIError } from '@/lib/ai/error-doctor';
import { classifyModelBilling } from '@/lib/ai/free-guard';
import { withTimeout } from '@/lib/ai/timeout';

export const maxDuration = 60;

const HEALTH_DATA_TIMEOUT_MS = 8_000;
const PROVIDER_HEALTH_TIMEOUT_MS = 12_000;

interface ProviderHealthResult {
  status: 'HEALTHY' | 'DEGRADED' | 'RATE_LIMITED' | 'AUTH_ERROR' | 'OFFLINE' | 'CONFIG_ERROR';
  latencyMs: number;
  diagnosis?: ReturnType<typeof diagnoseAIError>;
  lastChecked: string;
}

function providerIdFor(connection: { providerId?: string; baseUrl: string; modelId: string }) {
  if (connection.providerId) return connection.providerId;
  const baseUrl = connection.baseUrl.toLowerCase();
  const modelId = connection.modelId.toLowerCase();
  if (baseUrl.includes('google') || modelId.includes('gemini')) return 'google';
  if (baseUrl.includes('nvidia')) return 'nvidia';
  if (baseUrl.includes('openrouter')) return 'openrouter';
  if (baseUrl.includes('groq')) return 'groq';
  if (baseUrl.includes('together')) return 'together';
  if (baseUrl.includes('cerebras')) return 'cerebras';
  if (baseUrl.includes('sambanova')) return 'sambanova';
  return 'openai-compatible';
}

function isSafeRuntimeModel(connection: { providerId?: string; baseUrl: string; modelId: string }) {
  const billing = classifyModelBilling(providerIdFor(connection), connection.modelId);
  return billing === 'FREE_VERIFIED' || billing === 'FREE_LIMITED';
}

export async function GET() {
  let configuredConnections: AIConnection[];
  let runtimeConnections: AIConnection[];

  try {
    [configuredConnections, runtimeConnections] = await withTimeout(
      Promise.all([listConnections(), listRuntimeConnections()]),
      HEALTH_DATA_TIMEOUT_MS,
      'Health configuration load',
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not load AI health configuration.' },
      { status: 503 },
    );
  }

  const activeConfigured = configuredConnections.filter(
    (connection) => connection.isActive && isSafeRuntimeModel(connection),
  );
  const runtimeById = new Map(runtimeConnections.map((connection) => [connection.id, connection]));
  const providerChecks = new Map<string, Promise<ProviderHealthResult>>();

  const healthResults = await Promise.all(
    activeConfigured.map(async (configured) => {
      const runtime = runtimeById.get(configured.id);

      if (!configured.hasApiKey) {
        return {
          id: configured.id,
          name: configured.name,
          modelId: configured.modelId,
          provider: providerIdFor(configured),
          scope: configured.scope,
          status: 'CONFIG_ERROR' as const,
          latencyMs: 0,
          diagnosis: {
            code: 'CONFIG_ERROR',
            userTitle: 'API Key Missing',
            userMessage: 'This active model does not have an active provider API key available to the runtime.',
            recommendedAction: 'Open Admin > Integrations and save or reactivate the provider API key.',
          },
          lastChecked: new Date().toISOString(),
        };
      }

      if (!runtime) {
        return {
          id: configured.id,
          name: configured.name,
          modelId: configured.modelId,
          provider: providerIdFor(configured),
          scope: configured.scope,
          status: 'CONFIG_ERROR' as const,
          latencyMs: 0,
          diagnosis: {
            code: 'RUNTIME_BLOCKED',
            userTitle: 'Model Not Runtime Eligible',
            userMessage: 'The model is configured but is currently excluded from the safe AbhiAI runtime.',
            recommendedAction: 'Check Admin > Models and Integrations. Only active, Free Guard approved models with an active provider are used.',
          },
          lastChecked: new Date().toISOString(),
        };
      }

      const providerId = providerIdFor(runtime);
      const providerCheckKey = `${providerId}|${runtime.baseUrl}`;

      if (!providerChecks.has(providerCheckKey)) {
        providerChecks.set(providerCheckKey, (async () => {
          const startedAt = Date.now();
          const lastChecked = new Date().toISOString();

          try {
            const adapter = getProviderAdapter(providerId, runtime.baseUrl);
            if (!adapter) {
              return {
                status: 'CONFIG_ERROR' as const,
                latencyMs: 0,
                diagnosis: {
                  code: 'CONFIG_ERROR',
                  userTitle: 'Provider Adapter Missing',
                  userMessage: 'AbhiAI could not resolve a compatible provider adapter for this connection.',
                  recommendedAction: 'Review the provider configuration in Admin > Integrations.',
                },
                lastChecked,
              };
            }

            const isOk = await withTimeout(
              adapter.testConnection(runtime.apiKey),
              PROVIDER_HEALTH_TIMEOUT_MS,
              `${runtime.name} health check`,
            );
            return {
              status: isOk ? 'HEALTHY' as const : 'DEGRADED' as const,
              latencyMs: Date.now() - startedAt,
              lastChecked,
            };
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error || 'Provider health check failed');
            const diagnosis = diagnoseAIError(message);
            const status = diagnosis.code === 401
              ? 'AUTH_ERROR' as const
              : diagnosis.code === 429
                ? 'RATE_LIMITED' as const
                : diagnosis.code === 'TIMEOUT'
                  ? 'DEGRADED' as const
                  : 'OFFLINE' as const;

            return {
              status,
              latencyMs: Date.now() - startedAt,
              diagnosis,
              lastChecked,
            };
          }
        })());
      }

      const providerHealth = await providerChecks.get(providerCheckKey)!;
      return {
        id: configured.id,
        name: configured.name,
        modelId: configured.modelId,
        provider: providerId,
        scope: configured.scope,
        runtimeEligible: true,
        ...providerHealth,
      };
    }),
  );

  return NextResponse.json({
    health: healthResults,
    summary: {
      activeModels: activeConfigured.length,
      runtimeModels: runtimeConnections.length,
      checkedProviders: providerChecks.size,
    },
  });
}
