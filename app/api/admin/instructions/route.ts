import { NextResponse } from 'next/server';
import { getStoredInstructions, saveStoredInstructions } from '@/lib/data/admin-config';

export async function GET() {
  try {
    return NextResponse.json(await getStoredInstructions());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load instructions' }, { status: 503 });
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json();
    await saveStoredInstructions(data.systemPrompt);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
