import { NextRequest, NextResponse } from 'next/server';
import { getProviderAdapter } from '@/lib/ai/providers/registry';
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
        { error: 'No active API key is stored for this provider. Add a key first, then test again.' },
        { status: 400 },
      );
    }

    const adapter = getProviderAdapter(providerId, baseUrl);
    if (!adapter) {
      return NextResponse.json({ error: `Provider ${providerId} not found.` }, { status: 404 });
    }

    const success = await adapter.testConnection(resolvedApiKey);
    return NextResponse.json({
      success,
      message: 'Connection test passed successfully.',
      usedStoredKey: !apiKey?.trim(),
    });
  } catch (error) {
    console.error('Provider test failed:', error instanceof Error ? error.message : 'Unknown provider error');
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to connect to the AI provider.' },
      { status: 500 },
    );
  }
}
