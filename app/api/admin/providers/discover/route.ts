import { NextRequest, NextResponse } from 'next/server';
import { getProviderAdapter } from '@/lib/ai/providers/registry';
import { classifyModelBilling } from '@/lib/ai/free-guard';
import { getStoredProviderApiKey } from '@/lib/data/ai-config';

export async function POST(req: NextRequest) {
  try {
    const { providerId, apiKey, baseUrl } = await req.json();

    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID is required.' }, { status: 400 });
    }

    const resolvedApiKey = apiKey?.trim() || await getStoredProviderApiKey(providerId);
    if (!resolvedApiKey) {
      return NextResponse.json(
        { error: 'No active API key is stored for this provider. Add a key before discovering models.' },
        { status: 400 },
      );
    }

    const adapter = getProviderAdapter(providerId, baseUrl);
    if (!adapter) {
      return NextResponse.json({ error: `Provider ${providerId} not found.` }, { status: 404 });
    }

    const rawModels = await adapter.discoverModels(resolvedApiKey);
    const models = rawModels.map((model) => {
      const billingClassification = classifyModelBilling(providerId, model.id);
      return {
        ...model,
        billingClassification,
        isFree: billingClassification === 'FREE_VERIFIED' || billingClassification === 'FREE_LIMITED',
      };
    });

    return NextResponse.json({
      models,
      usedStoredKey: !apiKey?.trim(),
    });
  } catch (error) {
    console.error('Model discovery failed:', error instanceof Error ? error.message : 'Unknown provider error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to discover models from the provider.' },
      { status: 500 },
    );
  }
}
