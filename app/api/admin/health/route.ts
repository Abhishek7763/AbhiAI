import { NextResponse } from 'next/server';
import { getConnections } from '@/lib/connections';
import { getProviderAdapter } from '@/lib/ai/providers/registry';
import { diagnoseAIError } from '@/lib/ai/error-doctor';

export async function GET() {
  const connections = getConnections();
  const connList = Object.values(connections);

  const healthResults = await Promise.all(
    connList.map(async (conn) => {
      const startTime = Date.now();
      try {
        const guessProvider = conn.baseUrl.includes('nvidia') ? 'nvidia' 
          : conn.baseUrl.includes('openrouter') ? 'openrouter' 
          : conn.baseUrl.includes('groq') ? 'groq' 
          : conn.baseUrl.includes('together') ? 'together' 
          : 'openai-compatible';

        const adapter = getProviderAdapter(guessProvider, conn.baseUrl);
        if (!adapter) {
          return {
            id: conn.id,
            name: conn.name,
            modelId: conn.modelId,
            scope: conn.scope,
            status: 'CONFIG_ERROR',
            latencyMs: 0,
            diagnosis: {
              code: 'CONFIG_ERROR',
              userTitle: 'Adapter Missing',
              userMessage: 'Provider configuration could not be resolved.',
              recommendedAction: 'Re-save connection in Admin.',
            },
          };
        }

        const isOk = await adapter.testConnection(conn.apiKey);
        const latencyMs = Date.now() - startTime;

        return {
          id: conn.id,
          name: conn.name,
          modelId: conn.modelId,
          scope: conn.scope,
          status: isOk ? 'HEALTHY' : 'DEGRADED',
          latencyMs,
          lastChecked: new Date().toISOString(),
        };
      } catch (err: any) {
        const latencyMs = Date.now() - startTime;
        const diag = diagnoseAIError(err.message);
        const status = diag.code === 401 ? 'AUTH_ERROR' 
          : diag.code === 429 ? 'RATE_LIMITED' 
          : 'OFFLINE';

        return {
          id: conn.id,
          name: conn.name,
          modelId: conn.modelId,
          scope: conn.scope,
          status,
          latencyMs,
          diagnosis: diag,
          rawError: err.message,
          lastChecked: new Date().toISOString(),
        };
      }
    })
  );

  return NextResponse.json({ health: healthResults });
}
