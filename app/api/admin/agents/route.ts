import { NextRequest, NextResponse } from 'next/server';
import { getAgents, saveAgents, AIAgent } from '@/lib/agents';
import { FILE_STORE_UNAVAILABLE_MESSAGE } from '@/lib/config/file-store';

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

    if (!saveAgents(body.agents as AIAgent[])) {
      return NextResponse.json(
        { error: FILE_STORE_UNAVAILABLE_MESSAGE },
        { status: 503 },
      );
    }
    return NextResponse.json({ success: true, agents: body.agents });
  } catch (e: any) {
    console.error('Error saving agents:', e);
    return NextResponse.json({ error: e.message || 'Failed to save agents' }, { status: 500 });
  }
}
