import { NextResponse } from 'next/server';
import type { AIConnection } from '@/lib/connections';
import { listConnections, listRuntimeConnections } from '@/lib/data/ai-config';
import { getProviderAdapter } from '@/lib/ai/providers/registry';
import { diagnoseAIError } from '@/lib/ai/error-doctor';
import { classifyModelBilling } from '@/lib/ai/free-guard';
import { listRuntimeRoutingSignals } from '@/lib/ai/runtime-health';
import { withTimeout } from '@/lib/ai/timeout';

export const maxDuration = 60;

const HEALTH_DATA_TIMEOUT_MS = 8_000;
const PROVIDER_HEALTH_TIMEOUT_MS = 12_000;

type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'RATE_LIMITED' | 'AUTH_ERROR' | 'OFFLINE' | 'CONFIG_ERROR';

interface ProviderHealthResult {
  status: HealthStatus;
  latencyMs: number;
  diagnosis?: ReturnType<typeof diagnoseAIError>;
  failureReason: string | null;
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

function configError(
  configured: AIConnection,
  title: string,
  message: string,
  action: string,
  code: string,
) {
  const lastChecked = new Date().toISOString();
  return {
    id: configured.id,
    name: configured.name,
    modelId: configured.modelId,
    provider: providerIdFor(configured),
    scope: configured.scope,
    runtimeEligible: false,
    status: 'CONFIG_ERROR' as const,
    latencyMs: 0,
    diagnosis: {
      code,
      userTitle: title,
      userMessage: message,
      recommendedAction: action,
    },
    failureReason: title,
    lastChecked,
  };
}

export async function GET() {
  let configuredConnections: AIConnection[];
  let runtimeConnections: AIConnection[];
  let runtimeSignals: Awaited<ReturnType<typeof listRuntimeRoutingSignals>>;

  try {
    [configuredConnections, runtimeConnections, runtimeSignals] = await withTimeout(
      Promise.all([listConnections(), listRuntimeConnections(), listRuntimeRoutingSignals()]),
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
  const runtimeSignalById = new Map(runtimeSignals.map((signal) => [signal.id, signal]));
  const providerChecks = new Map<string, Promise<ProviderHealthResult>>();

  const healthResults = await Promise.all(
    activeConfigured.map(async (configured) => {
      const runtime = runtimeById.get(configured.id);
      const runtimeSignal = runtimeSignalById.get(configured.id) ?? null;

      if (!configured.hasApiKey) {
        return {
          ...configError(
            configured,
            'API Key Missing',
            'This active model does not have an active provider API key available to the runtime.',
            'Open Admin > Integrations and save or reactivate the provider API key.',
            'CONFIG_ERROR',
          ),
          runtime: runtimeSignal,
        };
      }

      if (!runtime) {
        return {
          ...configError(
            configured,
            'Model Not Runtime Eligible',
            'The model is configured but is currently excluded from the safe AbhiAI runtime.',
            'Check Admin > Models and Integrations. Only active, Free Guard approved models with an active provider are used.',
            'RUNTIME_BLOCKED',
          ),
          runtime: runtimeSignal,
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
                failureReason: 'Provider Adapter Missing',
                lastChecked,
              };
            }

            const isOk = await withTimeout(
              adapter.testConnection(runtime.apiKey),
              PROVIDER_HEALTH_TIMEOUT_MS,
              `${runtime.name} health check`,
            );

            if (!isOk) {
              return {
                status: 'DEGRADED' as const,
                latencyMs: Date.now() - startedAt,
                diagnosis: {
                  code: 'DEGRADED',
                  userTitle: 'Provider Check Did Not Pass',
                  userMessage: 'The provider responded, but its connection test did not report a healthy state.',
                  recommendedAction: 'Retry the diagnostic and verify provider configuration if this continues.',
                },
                failureReason: 'Provider check did not pass',
                lastChecked,
              };
            }

            return {
              status: 'HEALTHY' as const,
              latencyMs: Date.now() - startedAt,
              failureReason: null,
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
              failureReason: diagnosis.userTitle,
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
        runtime: runtimeSignal,
        ...providerHealth,
      };
    }),
  );

  const statusCounts = healthResults.reduce<Record<HealthStatus, number>>(
    (counts, item) => {
      counts[item.status] += 1;
      return counts;
    },
    {
      HEALTHY: 0,
      DEGRADED: 0,
      RATE_LIMITED: 0,
      AUTH_ERROR: 0,
      OFFLINE: 0,
      CONFIG_ERROR: 0,
    },
  );

  return NextResponse.json({
    health: healthResults,
    summary: {
      activeModels: activeConfigured.length,
      runtimeModels: runtimeConnections.length,
      checkedProviders: providerChecks.size,
      statusCounts,
      generatedAt: new Date().toISOString(),
    },
  });
}
