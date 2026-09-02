import { NextRequest, NextResponse } from 'next/server';
import { getProviderAdapter } from '@/lib/ai/providers/registry';

export async function POST(req: NextRequest) {
  try {
    const { providerId, apiKey, baseUrl } = await req.json();

    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID is required' }, { status: 400 });
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 });
    }

    const adapter = getProviderAdapter(providerId, baseUrl);
    if (!adapter) {
      return NextResponse.json({ error: `Provider ${providerId} not found` }, { status: 404 });
    }

    const success = await adapter.testConnection(apiKey);
    return NextResponse.json({ success, message: 'Connection test passed successfully!' });
  } catch (error: any) {
    console.error('Provider test error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to connect to AI provider. Please verify your API key and base URL.' },
      { status: 500 }
    );
  }
}
