import { NextResponse } from 'next/server';
import { listPublicAliases } from '@/lib/data/public-aliases';

export async function GET() {
  try {
    const aliases = await listPublicAliases();
    return NextResponse.json({
      models: [
        { id: 'auto', name: 'AbhiAI Auto' },
        ...aliases,
      ],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load models' }, { status: 503 });
  }
}
