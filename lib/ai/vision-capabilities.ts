import type { AIConnection } from '@/lib/connections';

export type VisionRoutingSignal = {
  capabilities?: string[] | null;
};

/**
 * Returns true when a runtime connection can safely receive image content.
 * Admin/runtime capability metadata is authoritative when present; conservative
 * model/provider heuristics keep older saved connections usable during upgrades.
 */
export function connectionSupportsVision(
  connection: Pick<AIConnection, 'name' | 'modelId' | 'providerId' | 'baseUrl'>,
  signal?: VisionRoutingSignal,
) {
  const capabilities = new Set(
    (signal?.capabilities ?? []).map((capability) => capability.trim().toLowerCase()),
  );

  if (
    capabilities.has('vision') ||
    capabilities.has('image') ||
    capabilities.has('multimodal')
  ) {
    return true;
  }

  const provider = (connection.providerId || '').toLowerCase();
  const identity = `${connection.name} ${connection.modelId} ${connection.baseUrl}`.toLowerCase();

  if (provider === 'google' || identity.includes('gemini')) return true;

  return (
    /(?:^|[\s/_-])(vision|vl|llava|pixtral)(?:$|[\s/_-])/.test(identity) ||
    /qwen[^\s]*vl/.test(identity) ||
    /phi[^\s]*vision/.test(identity) ||
    /gpt-4o|gpt-4\.1/.test(identity) ||
    /claude-(?:3|sonnet-4|opus-4)/.test(identity)
  );
}
