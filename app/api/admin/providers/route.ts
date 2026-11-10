import { NextResponse } from 'next/server';
import { listProviders, upsertProvider } from '@/lib/data/ai-config';
import { PROVIDER_TEMPLATES } from '@/lib/ai/providers/registry';

export async function GET() {
  try {
    return NextResponse.json({ providers: await listProviders() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load providers' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const template = PROVIDER_TEMPLATES.find((item) => item.id === data.id);
    const provider = await upsertProvider({
      slug: data.id,
      name: data.name || template?.name || data.id,
      baseUrl: data.baseUrl ?? template?.baseUrl ?? '',
      isActive: data.isActive,
      apiKey: data.apiKey,
      keyLabel: data.keyLabel,
    });
    return NextResponse.json({ success: true, provider });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Invalid request' }, { status: 400 });
  }
}
