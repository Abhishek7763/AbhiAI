import { NextResponse } from 'next/server';
import { getPublicAliasMappings, savePublicAliasMappings } from '@/lib/data/public-aliases';
import { listRoutingModelOptions } from '@/lib/data/routing-config';

export async function GET() {
  try {
    const [aliases, models] = await Promise.all([getPublicAliasMappings(), listRoutingModelOptions()]);
    return NextResponse.json({ aliases, models: models.filter((model) => model.runtimeEligible) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load public aliases' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const aliases = await savePublicAliasMappings(body?.aliases);
    return NextResponse.json({ success: true, aliases });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save public aliases' }, { status: 400 });
  }
}
