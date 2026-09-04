import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/admin-auth';
import { getPublicAliasMappings, savePublicAliasMappings } from '@/lib/data/public-aliases';
import { listRoutingModelOptions } from '@/lib/data/routing-config';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const [aliases, models] = await Promise.all([getPublicAliasMappings(), listRoutingModelOptions()]);
    return NextResponse.json({ aliases, models: models.filter((model) => model.runtimeEligible) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load public aliases' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json();
    const aliases = await savePublicAliasMappings(body?.aliases);
    return NextResponse.json({ aliases });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to save public aliases' }, { status: 400 });
  }
}
