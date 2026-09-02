import { NextRequest, NextResponse } from 'next/server';
import { getProviderAdapter } from '@/lib/ai/providers/registry';
import { classifyModelBilling } from '@/lib/ai/free-guard';

export async function POST(req: NextRequest) {
  try {
    const { providerId, apiKey, baseUrl } = await req.json();

    if (!providerId || !apiKey) {
      return NextResponse.json({ error: 'Provider ID and API Key are required' }, { status: 400 });
    }

    const adapter = getProviderAdapter(providerId, baseUrl);
    if (!adapter) {
      return NextResponse.json({ error: `Provider ${providerId} not found` }, { status: 404 });
    }

    const rawModels = await adapter.discoverModels(apiKey);

    // Annotate discovered models with free guard billing classification
    const enrichedModels = rawModels.map(m => {
      const billing = classifyModelBilling(providerId, m.id);
      return {
        ...m,
        billingClassification: billing,
        isFree: billing === 'FREE_VERIFIED' || billing === 'FREE_LIMITED',
      };
    });

    return NextResponse.json({ models: enrichedModels });
  } catch (error: any) {
    console.error('Model discovery error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to auto-discover models from provider.' },
      { status: 500 }
    );
  }
}
