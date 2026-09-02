import { NextResponse } from 'next/server';
import { getRoutingConfig, listRoutingModelOptions, saveRoutingConfig } from '@/lib/data/routing-config';

export async function GET() {
  try {
    const [config, models] = await Promise.all([
      getRoutingConfig(),
      listRoutingModelOptions(),
    ]);
    return NextResponse.json({ config, models });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load routing configuration.' },
      { status: 503 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const config = await saveRoutingConfig(body);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save routing configuration.' },
      { status: 400 },
    );
  }
}
