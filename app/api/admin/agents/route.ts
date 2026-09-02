import { NextRequest, NextResponse } from 'next/server';
import type { AIAgent } from '@/lib/agents';
import { getStoredAgents, saveStoredAgents } from '@/lib/data/admin-config';

export async function GET() {
  try {
    return NextResponse.json({ agents: await getStoredAgents() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load agents' }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.agents)) {
      return NextResponse.json({ error: 'Expected agents array' }, { status: 400 });
    }

    await saveStoredAgents(body.agents as AIAgent[]);
    return NextResponse.json({ success: true, agents: body.agents });
  } catch (e: any) {
    console.error('Error saving agents:', e);
    return NextResponse.json({ error: e.message || 'Failed to save agents' }, { status: 500 });
  }
}
