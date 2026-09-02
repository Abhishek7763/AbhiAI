import { NextRequest, NextResponse } from 'next/server';
import { getAgents, saveAgents, AIAgent } from '@/lib/agents';

export async function GET() {
  const agents = getAgents();
  return NextResponse.json({ agents });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!Array.isArray(body.agents)) {
      return NextResponse.json({ error: 'Expected agents array' }, { status: 400 });
    }

    saveAgents(body.agents as AIAgent[]);
    return NextResponse.json({ success: true, agents: body.agents });
  } catch (e: any) {
    console.error('Error saving agents:', e);
    return NextResponse.json({ error: e.message || 'Failed to save agents' }, { status: 500 });
  }
}
